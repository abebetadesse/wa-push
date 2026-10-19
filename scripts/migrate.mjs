/**
 * Applies the SQL migrations in ./drizzle with production dependencies only (no drizzle-kit).
 * Uses the same migration history table as `drizzle-kit migrate`, so either can be used.
 *
 *   node scripts/migrate.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
nextEnv.loadEnvConfig(root, false, { info() {}, error: console.error });

export async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    console.warn("[migrate] DATABASE_URL is not set. Skipping migration.");
    return false;
  }

  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    try {
      const [oldTables] = await connection.query("SHOW TABLES LIKE '__drizzle_migrations'");
      if (Array.isArray(oldTables) && oldTables.length > 0) {
        const [newTables] = await connection.query("SHOW TABLES LIKE 'school_drizzle_migrations'");
        if (Array.isArray(newTables) && newTables.length === 0) {
          await connection.query("CREATE TABLE `school_drizzle_migrations` LIKE `__drizzle_migrations`");
          await connection.query("INSERT INTO `school_drizzle_migrations` SELECT * FROM `__drizzle_migrations`");
          console.log("[migrate] Copied migration history from __drizzle_migrations to school_drizzle_migrations.");
        } else {
          const [rowCount] = await connection.query("SELECT COUNT(*) AS c FROM `school_drizzle_migrations`");
          if (rowCount[0]?.c === 0) {
            await connection.query("INSERT INTO `school_drizzle_migrations` SELECT * FROM `__drizzle_migrations`");
            console.log("[migrate] Seeded empty school_drizzle_migrations with history from __drizzle_migrations.");
          }
        }
      }
    } catch {
      // Ignore history transition errors
    }

    await migrate(drizzle(connection), {
      migrationsFolder: path.join(root, "drizzle"),
      migrationsTable: "school_drizzle_migrations",
    });
    let applied = 0;
    try {
      const [rows] = await connection.query("SELECT COUNT(*) AS applied FROM `school_drizzle_migrations`");
      applied = rows[0]?.applied ?? 0;
    } catch {
      const [rows] = await connection.query("SELECT COUNT(*) AS applied FROM `__drizzle_migrations`");
      applied = rows[0]?.applied ?? 0;
    }
    console.log(`[migrate] database is up to date (${applied} migrations applied).`);
    return true;
  } catch (error) {
    console.error("[migrate] failed:", error instanceof Error ? error.message : error);
    throw error;
  } finally {
    await connection.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runMigrations().catch(() => {
    process.exitCode = 1;
  });
}
