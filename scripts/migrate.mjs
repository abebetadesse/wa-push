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

if (!process.env.DATABASE_URL) {
  console.warn("[migrate] DATABASE_URL is not set. Skipping migration until DATABASE_URL is configured in .env.");
  process.exit(0);
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await migrate(drizzle(connection), { migrationsFolder: path.join(root, "drizzle") });
  const [rows] = await connection.query("SELECT COUNT(*) AS applied FROM `__drizzle_migrations`");
  console.log(`[migrate] database is up to date (${rows[0].applied} migrations applied).`);
} catch (error) {
  console.error("[migrate] failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await connection.end();
}
