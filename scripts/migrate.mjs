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

const tablesToRename = [
  ["auth_users", "school_auth_users"],
  ["auth_sessions", "school_auth_sessions"],
  ["auth_accounts", "school_auth_accounts"],
  ["auth_verifications", "school_auth_verifications"],
  ["schools", "school_schools"],
  ["activity_events", "school_activity_events"],
  ["academic_years", "school_academic_years"],
  ["grade_levels", "school_grade_levels"],
  ["classrooms", "school_classrooms"],
  ["students", "school_students"],
  ["enrollments", "school_enrollments"],
  ["subjects", "school_subjects"],
  ["teachers", "school_teachers"],
  ["lesson_plans", "school_lesson_plans"],
  ["assessments", "school_assessments"],
  ["assessment_questions", "school_assessment_questions"],
  ["learning_resources", "school_learning_resources"],
  ["assessment_results", "school_assessment_results"],
  ["assessment_attempts", "school_assessment_attempts"],
  ["class_schedules", "school_class_schedules"],
  ["attendance_records", "school_attendance_records"],
  ["inventory_items", "school_inventory_items"],
  ["inventory_movements", "school_inventory_movements"],
  ["staff_members", "school_staff_members"],
];

const knownMigrations = [
  { id: 1, hash: "9972594da7af2abc62d5794dfc037c611264e112bf578735189435685d5edf0b", created_at: 1792139085116 },
  { id: 2, hash: "8c010babc91a22d6298fd06f8d8131c725f447b6f0b85455ce8b7f24467c1e85", created_at: 1792143444042 },
  { id: 3, hash: "9c0bdf6c3fb0e4400345f349202aea86e386b7e32052cc3c1da2d4ccbbaa8071", created_at: 1792161069647 },
  { id: 4, hash: "0430b5c437ab19471bbb860f6e1245f4dfabdcea842d82e5df951ff6d5810a0e", created_at: 1792169009545 },
  { id: 5, hash: "743a5ed5dbb640398bfc7f09c22918c1aeaaebfb5c386daa47657dead359aa85", created_at: 1792171617523 },
  { id: 6, hash: "6d6bd067a2ce7b8bd89a674a417a89ea8145fd8505d2053acbe0937b7a446444", created_at: 1792173766181 },
  { id: 7, hash: "f7cefd21c1a7475c0a3c4ab7fb2d0816cb8687d420939311eafad33ca46df767", created_at: 1792429587063 },
];

export async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    console.warn("[migrate] DATABASE_URL is not set. Skipping migration.");
    return false;
  }

  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    // 1. Ensure school_drizzle_migrations table exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`school_drizzle_migrations\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`hash\` text NOT NULL,
        \`created_at\` bigint DEFAULT NULL,
        PRIMARY KEY (\`id\`)
      )
    `);

    // 2. Rename legacy unprefixed tables to the school_ prefix — only when asked to.
    //    The production database is shared with another application whose tables have the same
    //    unprefixed names (auth_users, auth_sessions, …). Renaming them unasked moves that
    //    application's data into Forma, and breaks it. Set FORMA_RENAME_LEGACY_TABLES=1 for a
    //    database that holds only Forma's old unprefixed tables.
    const renameLegacyTables = process.env.FORMA_RENAME_LEGACY_TABLES === "1";
    if (renameLegacyTables) await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    try {
      for (const [oldName, newName] of renameLegacyTables ? tablesToRename : []) {
        try {
          const [oldRows] = await connection.query(`SHOW TABLES LIKE '${oldName}'`);
          const [newRows] = await connection.query(`SHOW TABLES LIKE '${newName}'`);
          if (Array.isArray(oldRows) && oldRows.length > 0 && Array.isArray(newRows) && newRows.length === 0) {
            await connection.query(`RENAME TABLE \`${oldName}\` TO \`${newName}\``);
            console.log(`[migrate] Renamed legacy table ${oldName} to ${newName}`);
          }
        } catch (renameErr) {
          console.warn(`[migrate] Notice on renaming ${oldName}:`, renameErr instanceof Error ? renameErr.message : renameErr);
        }
      }
    } finally {
      if (renameLegacyTables) await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    }

    // 3. Inspect if our tables actually exist.
    //    On shared databases, school_drizzle_migrations might have records from earlier failed/partial
    //    runs, but if neither school_auth_users nor legacy auth_users exists, the database is in an
    //    uninitialized state. In that case, any entries in school_drizzle_migrations are stale and must
    //    be cleared so Drizzle doesn't skip running migrations 0000..0006 from scratch.
    try {
      const [authUsersRows] = await connection.query("SHOW TABLES LIKE 'school_auth_users'");
      const hasSchoolAuthUsers = Array.isArray(authUsersRows) && authUsersRows.length > 0;

      const [legacyAuthUsersRows] = await connection.query("SHOW TABLES LIKE 'auth_users'");
      const hasLegacyAuthUsers = Array.isArray(legacyAuthUsersRows) && legacyAuthUsersRows.length > 0;

      if (!hasSchoolAuthUsers && !hasLegacyAuthUsers) {
        const [existingMigrations] = await connection.query("SELECT COUNT(*) AS count FROM `school_drizzle_migrations`");
        const migrationCount = existingMigrations[0]?.count ?? 0;
        if (migrationCount > 0) {
          console.warn(`[migrate] Stale migration records found (${migrationCount}) but school_auth_users is missing. Resetting migration table...`);
          await connection.query("DELETE FROM `school_drizzle_migrations`");
        }
      } else if (hasSchoolAuthUsers) {
        // Our tables exist with the school_ prefix — seed migration history so Drizzle does
        // not try to re-run migrations that already produced this state.
        for (const m of knownMigrations) {
          await connection.query(
            "INSERT IGNORE INTO `school_drizzle_migrations` (`id`, `hash`, `created_at`) VALUES (?, ?, ?)",
            [m.id, m.hash, m.created_at],
          );
        }
      }
    } catch (e) {
      console.warn("[migrate] Warning inspecting existing migration state:", e instanceof Error ? e.message : e);
    }

    // 4. Run Drizzle migration engine
    await migrate(drizzle(connection), {
      migrationsFolder: path.join(root, "drizzle"),
      migrationsTable: "school_drizzle_migrations",
    });

    let applied = 0;
    try {
      const [rows] = await connection.query("SELECT COUNT(*) AS applied FROM `school_drizzle_migrations`");
      applied = rows[0]?.applied ?? 0;
    } catch {
      applied = 0;
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
