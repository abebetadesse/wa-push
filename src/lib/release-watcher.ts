import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Plesk's Git deployment replaces the files on disk but never restarts the running Node.js process,
 * so the site kept serving the previous release until Passenger happened to recycle it. Watch the
 * build ID and, once a new release has stopped changing for a minute (so the deployment and
 * `npm ci` have finished), restart into it: touch tmp/restart.txt and, under Passenger, exit so the
 * next request starts a fresh process. Outside Passenger only the restart file is written.
 *
 * Started from instrumentation.ts, so it runs however the server is launched (app.js or next start).
 */
export function restartWhenReleaseChanges() {
  const root = /* turbopackIgnore: true */ process.cwd();
  const buildIdFile = join(root, ".next", "BUILD_ID");
  const readBuildId = () => {
    try {
      return readFileSync(buildIdFile, "utf8").trim();
    } catch {
      return "";
    }
  };

  const running = readBuildId();
  if (!running) return;

  let pending = "";
  let pendingSince = 0;
  const timer = setInterval(() => {
    const onDisk = readBuildId();
    if (!onDisk || onDisk === running) {
      pending = "";
      return;
    }
    if (onDisk !== pending) {
      pending = onDisk;
      pendingSince = Date.now();
      console.log(`[forma] release ${onDisk} found on disk (running ${running}); restarting once it settles.`);
      return;
    }
    if (Date.now() - pendingSince < 60_000) return;

    clearInterval(timer);
    console.log(`[forma] restarting to load release ${onDisk}.`);
    try {
      mkdirSync(join(root, "tmp"), { recursive: true });
      writeFileSync(join(root, "tmp", "restart.txt"), `${Date.now()}\n`);
    } catch {
      // Passenger may not watch this folder; the exit below still restarts the app.
    }
    if ((globalThis as { PhusionPassenger?: unknown }).PhusionPassenger) {
      // Give requests in flight a moment to finish; Passenger serves the next one from a new process.
      setTimeout(() => process.exit(0), 3_000);
    }
  }, 15_000);
  timer.unref();
}
