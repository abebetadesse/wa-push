/**
 * Production entry point for hosts that start a Node.js application from one file
 * (Plesk → Node.js → "Application Startup File", Phusion Passenger, or plain `node app.js`).
 *
 * It serves the build made by `npm run deploy:plesk` (or `npm run build`). Settings come from the
 * host's environment variables or from a .env file beside this file. The port is taken from PORT;
 * under Passenger the value does not matter because Passenger supplies the socket.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- Passenger loads this file as CommonJS. */
const { createServer } = require("node:http");
const { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");
const next = require("next");

async function start() {
  process.env.NODE_ENV = "production";
  // Passenger may start the app from another directory; .env and var/uploads are relative to here.
  process.chdir(__dirname);

  // Read .env now so PORT is known before the server starts. Host-provided variables win.
  require("@next/env").loadEnvConfig(__dirname, false, { info() {}, error: console.error });

  // Automatically apply any pending database migrations in-process on startup
  globalThis.__migrationStatus = { attempted: false, cwd: __dirname };
  if (process.env.DATABASE_URL) {
    globalThis.__migrationStatus.attempted = true;
    try {
      const migrateScript = join(__dirname, "scripts", "migrate.mjs");
      if (existsSync(migrateScript)) {
        console.log("[forma] checking database migrations on startup...");
        const { runMigrations } = await import(pathToFileURL(migrateScript).href);
        if (typeof runMigrations === "function") {
          await runMigrations();
          globalThis.__migrationStatus.ok = true;
          console.log("[forma] startup database migration completed.");
        } else {
          globalThis.__migrationStatus.ok = false;
          globalThis.__migrationStatus.error = "runMigrations is not an exported function";
        }
      } else {
        globalThis.__migrationStatus.ok = false;
        globalThis.__migrationStatus.error = "migrate.mjs not found at " + migrateScript;
      }
    } catch (err) {
      globalThis.__migrationStatus.ok = false;
      globalThis.__migrationStatus.error = err && err.message ? err.message : String(err);
      console.error("[forma] startup database migration:", err && err.message ? err.message : err);
    }
  }

  clearCacheFromOtherBuilds();

  const port = Number(process.env.PORT) || 3000;
  const app = next({ dev: false, dir: __dirname, hostname: process.env.HOSTNAME || "0.0.0.0", port });
  await app.prepare();

  const handle = app.getRequestHandler();
  const server = createServer((req, res) => {
    handle(req, res).catch((error) => {
      console.error(JSON.stringify({ level: "error", time: new Date().toISOString(), message: error && error.message, path: (req.url || "").split("?")[0] }));
      if (!res.headersSent) res.statusCode = 500;
      res.end();
    });
  });
  server.keepAliveTimeout = 65_000;
  server.listen(port, () => console.log(`[forma] ready on port ${port}`));

  const stop = (signal) => {
    console.log(`[forma] ${signal} received, closing`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on("SIGTERM", () => stop("SIGTERM"));
  process.on("SIGINT", () => stop("SIGINT"));
}

/**
 * Next.js saves rendered pages in .next/server/route-cache, keyed by route but not by build, and
 * serves them before the pages in the release. A Git deployment never removes that folder, so after
 * a release the old build's HTML (with its old asset URLs, e.g. /school/_next/...) would still be
 * served. Empty it whenever the build changes.
 */
function clearCacheFromOtherBuilds() {
  const buildIdFile = join(__dirname, ".next", "BUILD_ID");
  if (!existsSync(buildIdFile)) return;
  const buildId = readFileSync(buildIdFile, "utf8").trim();
  const marker = join(__dirname, ".next", "cache", "route-cache-build-id");
  try {
    if (existsSync(marker) && readFileSync(marker, "utf8").trim() === buildId) return;
    rmSync(join(__dirname, ".next", "server", "route-cache"), { recursive: true, force: true });
    mkdirSync(join(__dirname, ".next", "cache"), { recursive: true });
    writeFileSync(marker, `${buildId}\n`);
    console.log(`[forma] cleared cached pages from earlier builds (now ${buildId}).`);
  } catch (error) {
    console.error("[forma] could not clear cached pages:", error && error.message ? error.message : error);
  }
}

start().catch((error) => {
  console.error("[forma] failed to start:", error && error.message ? error.message : error);
  process.exit(1);
});
