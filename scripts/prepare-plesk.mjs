/**
 * Builds Forma and assembles an upload-ready release in ./plesk-release (plus plesk-release.zip).
 *
 *   npm run deploy:plesk                      served at https://<domain>/school (default)
 *   npm run deploy:plesk -- --base-path ""    served at the root of its own domain or subdomain
 *   node scripts/prepare-plesk.mjs --base-path /school --no-zip
 *
 * The base path is fixed into the build, so the release always matches the URL it was built for.
 * On the server: upload, `npm ci --omit=dev`, `npm run db:migrate`, start. See docs/DEPLOYMENT.md.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "plesk-release");
const buildDir = path.join(root, ".next");
const rel = (p) => path.relative(root, p).replaceAll("\\", "/");

const argIndex = process.argv.indexOf("--base-path");
const rawBasePath = argIndex >= 0 ? process.argv[argIndex + 1] ?? "" : "/school";
// Same rule as src/lib/base-path.ts.
const basePath = rawBasePath.trim().replace(/\/+$/, "");
if (basePath && !/^\/[A-Za-z0-9._~\-/]*$/.test(basePath)) {
  console.error(`Invalid --base-path "${rawBasePath}". Use a path such as /school, or "" for the site root.`);
  process.exit(1);
}

// 1. Production build with the chosen base path (it is inlined into the client and server bundles).
console.log(`[release] building for base path "${basePath || "/"}"...`);
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
execFileSync(process.execPath, [nextBin, "build"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_BASE_PATH: basePath },
});

// Empty the previous release (the folder itself may be open in a terminal or editor). Links, such
// as a node_modules linked in for local testing, are removed without touching what they point to.
fs.mkdirSync(out, { recursive: true });
for (const entry of fs.readdirSync(out)) {
  const target = path.join(out, entry);
  if (fs.lstatSync(target).isSymbolicLink()) fs.unlinkSync(target);
  else fs.rmSync(target, { recursive: true, force: true });
}
fs.mkdirSync(path.join(out, "scripts"), { recursive: true });

// 2. The compiled app without caches, traces, or the development server's output; static files.
const skipInBuild = new Set(["cache", "trace", "types", "diagnostics", "dev"]);
// Source maps are left out: they only help debugging and make up most of the build's size.
fs.cpSync(buildDir, path.join(out, ".next"), {
  recursive: true,
  filter: (source) => !(path.dirname(source) === buildDir && skipInBuild.has(path.basename(source))) && !source.endsWith(".map"),
});
fs.cpSync(path.join(root, "public"), path.join(out, "public"), { recursive: true });

// 3. Start-up file, lockfile, environment template, guide, and migrations.
for (const file of ["app.js", "package-lock.json", ".env.example"]) {
  fs.copyFileSync(path.join(root, file), path.join(out, file));
}
fs.copyFileSync(path.join(root, "docs", "DEPLOYMENT.md"), path.join(out, "DEPLOYMENT.md"));
fs.cpSync(path.join(root, "drizzle"), path.join(out, "drizzle"), { recursive: true });
fs.copyFileSync(path.join(root, "scripts", "migrate.mjs"), path.join(out, "scripts", "migrate.mjs"));

// 4. next.config and the admin bootstrap as plain JavaScript, so the server needs no TypeScript.
//    The base path is written into the config so it cannot drift from the build.
const esbuild = await import("esbuild");
await esbuild.build({
  entryPoints: [path.join(root, "next.config.ts")],
  outfile: path.join(out, "next.config.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  packages: "external",
  define: { "process.env.NEXT_PUBLIC_BASE_PATH": JSON.stringify(basePath) },
  logLevel: "warning",
});
await esbuild.build({
  entryPoints: { "create-platform-admin": path.join(root, "scripts", "create-platform-admin.ts") },
  outdir: path.join(out, "scripts"),
  outExtension: { ".js": ".cjs" },
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  packages: "external",
  tsconfig: path.join(root, "tsconfig.json"),
  logLevel: "warning",
});

// 5. package.json: same dependencies and lockfile, production scripts only.
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
pkg.scripts = {
  build: "node -e \"console.log('[build] Pre-built release; nothing to compile.')\"",
  start: "node app.js",
  "db:migrate": "node scripts/migrate.mjs",
  "auth:create-admin": "node scripts/create-platform-admin.cjs",
};
pkg.engines = { node: ">=20.9.0" };
fs.writeFileSync(path.join(out, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);

// 6. What this release is.
let commit = "unknown";
try {
  commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  if (execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim()) commit += "+uncommitted";
} catch {}
fs.writeFileSync(path.join(out, "RELEASE.json"), `${JSON.stringify({
  name: pkg.name,
  version: pkg.version,
  commit,
  basePath: basePath || "/",
  buildId: fs.readFileSync(path.join(buildDir, "BUILD_ID"), "utf8").trim(),
  builtAt: new Date().toISOString(),
}, null, 2)}\n`);
console.log(`[release] ${commit} for "${basePath || "/"}" assembled in ${rel(out)}.`);

// 7. One file to upload, when a zip tool is available.
if (!process.argv.includes("--no-zip")) {
  const zip = path.join(root, "plesk-release.zip");
  fs.rmSync(zip, { force: true });
  try {
    if (process.platform === "win32") {
      execFileSync(path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe"), ["-a", "-c", "-f", zip, "-C", out, "."], { stdio: "ignore" });
    } else {
      execFileSync("zip", ["-q", "-r", zip, "."], { cwd: out, stdio: "ignore" });
    }
    console.log(`[release] zipped to ${rel(zip)} (${(fs.statSync(zip).size / 1024 / 1024).toFixed(1)} MB). Upload it in Plesk → Files and choose "Extract files".`);
  } catch {
    fs.rmSync(zip, { force: true });
    console.log("[release] no zip tool found; upload the folder's contents instead.");
  }
}
