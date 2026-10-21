import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { restartWhenReleaseChanges } from "@/lib/release-watcher";

/**
 * Production start-up work. The host launches `next start`, not app.js, so pending migrations and
 * table repairs (scripts/migrate.mjs) run here as well. A failure is logged and shown by
 * /api/health; it must not stop the site from starting.
 */
export async function runStartupTasks() {
  try {
    const migrateScript = join(/* turbopackIgnore: true */ process.cwd(), "scripts", "migrate.mjs");
    if (existsSync(migrateScript)) {
      const { runMigrations } = await import(/* turbopackIgnore: true */ pathToFileURL(migrateScript).href);
      if (typeof runMigrations === "function") await runMigrations();
    }
  } catch (error) {
    console.error("[forma] startup migration failed:", error instanceof Error ? error.message : error);
  }

  restartWhenReleaseChanges();
}
