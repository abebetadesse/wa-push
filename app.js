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
const { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } = require("node:fs");
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
  const staticChunksDir = join(__dirname, ".next", "static", "chunks");

  function getActiveCssChunk() {
    try {
      if (existsSync(staticChunksDir)) {
        const files = readdirSync(staticChunksDir).filter((f) => f.endsWith(".css"));
        if (files.length > 0) {
          return { name: files[0], path: join(staticChunksDir, files[0]) };
        }
      }
    } catch {}
    return null;
  }

  const server = createServer((req, res) => {
    if (req.url) {
      const [pathname, search] = req.url.split("?");
      const query = search ? `?${search}` : "";

      if (pathname === "/school" || pathname === "/school/") {
        res.writeHead(307, { Location: `/${query}` });
        res.end();
        return;
      }

      if (pathname.startsWith("/school/")) {
        const strippedPath = pathname.slice(7);
        if (
          strippedPath.startsWith("/_next/") ||
          strippedPath.startsWith("/api/") ||
          strippedPath.startsWith("/favicon.ico") ||
          strippedPath.endsWith(".css") ||
          strippedPath.endsWith(".js") ||
          strippedPath.endsWith(".ico") ||
          strippedPath.endsWith(".png") ||
          strippedPath.endsWith(".svg")
        ) {
          req.url = strippedPath + query;
        } else {
          res.writeHead(307, { Location: strippedPath + query });
          res.end();
          return;
        }
      }

      // If a browser with a stale HTML page requests a missing CSS or JS chunk,
      // prevent 404s by serving the active bundle or triggering a clean reload.
      const [currentPath] = (req.url || "").split("?");
      if (currentPath.startsWith("/_next/static/chunks/")) {
        const chunkFileName = currentPath.slice("/_next/static/chunks/".length);
        const chunkFilePath = join(staticChunksDir, chunkFileName);
        if (!existsSync(chunkFilePath)) {
          if (chunkFileName.endsWith(".css")) {
            const activeCss = getActiveCssChunk();
            if (activeCss && existsSync(activeCss.path)) {
              res.writeHead(200, {
                "Content-Type": "text/css; charset=UTF-8",
                "Cache-Control": "public, max-age=31536000, immutable",
              });
              res.end(readFileSync(activeCss.path));
              return;
            }
          } else if (chunkFileName.endsWith(".js")) {
            res.writeHead(200, {
              "Content-Type": "application/javascript; charset=UTF-8",
              "Cache-Control": "no-cache",
            });
            // Reload once per tab: a window flag resets on reload, so a page whose cached HTML
            // keeps naming missing chunks would otherwise reload forever.
            res.end('/* outdated chunk */ (function () { try { if (typeof window === "undefined" || sessionStorage.getItem("forma-chunk-reload")) return; sessionStorage.setItem("forma-chunk-reload", "1"); window.location.reload(); } catch (e) {} })();');
            return;
          }
        }
      }
    }

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
  // Restarting into a newly deployed release is done by src/lib/release-watcher.ts, which Next.js
  // starts from instrumentation.ts, so it also runs when the host launches `next start` directly.
}

/**
 * Purges stale Next.js cache directories and legacy subpath route files on new deployments.
 */
function clearCacheFromOtherBuilds() {
  const buildIdFile = join(__dirname, ".next", "BUILD_ID");
  if (!existsSync(buildIdFile)) return;
  const buildId = readFileSync(buildIdFile, "utf8").trim();
  const marker = join(__dirname, ".next", "cache-cleared-build-" + buildId);

  if (existsSync(marker)) return;

  try {
    console.log(`[forma] new build detected (${buildId}), clearing stale caches...`);

    // 1. Clear Next.js cache directories
    rmSync(join(__dirname, ".next", "cache"), { recursive: true, force: true });
    rmSync(join(__dirname, ".next", "server", "route-cache"), { recursive: true, force: true });

    // 2. Remove legacy subpath route directories from earlier /school builds
    const legacyDirs = [
      join(__dirname, ".next", "server", "app", "school"),
      join(__dirname, ".next", "server", "pages", "school"),
    ];
    for (const dir of legacyDirs) {
      if (existsSync(dir)) {
        try {
          rmSync(dir, { recursive: true, force: true });
          console.log(`[forma] removed legacy subpath dir: ${dir}`);
        } catch {}
      }
    }

    // 3. Scan .next/server/app for any prerendered files with stale hashes
    const serverAppDir = join(__dirname, ".next", "server", "app");
    if (existsSync(serverAppDir)) {
      try {
        const entries = readdirSync(serverAppDir, { recursive: true });
        for (const entry of entries) {
          const str = typeof entry === "string" ? entry : (entry && entry.name);
          if (str && (str.endsWith(".html") || str.endsWith(".rsc") || str.endsWith(".meta"))) {
            const filePath = join(serverAppDir, str);
            try {
              const content = readFileSync(filePath, "utf8");
              if (content.includes("2liei9r0rllnf") || content.includes("tkCSGXaHkFoazYJWoOxJd")) {
                rmSync(filePath, { force: true });
                console.log(`[forma] purged stale prerender file: ${str}`);
              }
            } catch {}
          }
        }
      } catch (e) {
        console.warn("[forma] scanning server/app:", e.message);
      }
    }

    // 4. Touch tmp/restart.txt to signal worker restart
    try {
      const restartDir = join(__dirname, "tmp");
      mkdirSync(restartDir, { recursive: true });
      writeFileSync(join(restartDir, "restart.txt"), `${Date.now()}\n`);
    } catch {}

    mkdirSync(join(__dirname, ".next"), { recursive: true });
    writeFileSync(marker, `${new Date().toISOString()}\n`);
    console.log(`[forma] cache purge complete for build ${buildId}.`);
  } catch (error) {
    console.error("[forma] clearCacheFromOtherBuilds error:", error && error.message ? error.message : error);
  }
}

start().catch((error) => {
  console.error("[forma] failed to start:", error && error.message ? error.message : error);
  process.exit(1);
});
