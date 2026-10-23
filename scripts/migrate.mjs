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
  { id: 8, hash: "a263c48daac6b488e1a01c3c6329bc598ae7e5dcfdc0afb33a6698d05f81e4c3", created_at: 1792663148980 },
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

    // 4. Ensure fundamental prerequisite tables exist if earlier migrations were marked as completed
    await repairMembershipsTable(connection);
    await repairInvitationsTable(connection);
    await repairGradeLevelsTable(connection);
    await repairSubjectsTable(connection);
    await repairLearningResourcesTable(connection);

    // 5. Run Drizzle migration engine
    await migrate(drizzle(connection), {
      migrationsFolder: path.join(root, "drizzle"),
      migrationsTable: "school_drizzle_migrations",
    });

    // 6. Make sure the session table is Forma's own.
    await repairSessionTable(connection);

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
    const cause = typeof error === "object" && error !== null && "cause" in error ? error.cause : null;
    console.error(
      "[migrate] failed:",
      error instanceof Error ? error.message : error,
      cause ? `\n[migrate] cause: ${cause instanceof Error ? cause.message : JSON.stringify(cause)}` : "",
    );
    throw error;
  } finally {
    await connection.end();
  }
}

/**
 * On the shared production database, school_auth_sessions ended up being the other application's
 * session table (token_hash, last_seen_at, datetime columns) instead of Forma's, so every sign-in
 * failed when it saved the session. If the table lacks Forma's columns, move it aside under a
 * dated name — keeping its rows — and create Forma's table; if it is missing, create it. Sessions
 * are short-lived, so starting with an empty table only means signing in again.
 */
export async function repairSessionTable(connection) {
  const [columns] = await connection.query(
    "SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_auth_sessions'",
  );
  if (!Array.isArray(columns) || columns.length === 0) {
    // Missing although the migrations are recorded as applied, e.g. after copying Forma's tables
    // into a new database without the foreign session table. Nothing else would recreate it.
    console.warn("[migrate] school_auth_sessions is missing; creating it.");
  } else {
    const names = new Set(columns.map((column) => column.name));
    const required = ["id", "expires_at", "token", "created_at", "updated_at", "ip_address", "user_agent", "impersonated_by", "user_id"];
    if (required.every((name) => names.has(name))) return;

    const stamp = new Date().toISOString().slice(0, 19).replace(/\D/g, "");
    const asideName = `school_auth_sessions_foreign_${stamp}`;
    console.warn(`[migrate] school_auth_sessions is not Forma's session table; moving it to ${asideName}.`);
    await connection.query(`RENAME TABLE \`school_auth_sessions\` TO \`${asideName}\``);
  }

  // Match the users table's character set so the foreign key can be created.
  const [userTable] = await connection.query(
    "SELECT TABLE_COLLATION AS collation FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_auth_users'",
  );
  const collation = /^[a-z0-9_]+$/.test(userTable?.[0]?.collation ?? "") ? userTable[0].collation : "utf8mb4_unicode_ci";
  const charset = collation.split("_")[0];
  await connection.query(`
    CREATE TABLE \`school_auth_sessions\` (
      \`id\` varchar(36) NOT NULL,
      \`expires_at\` timestamp NOT NULL,
      \`token\` varchar(255) NOT NULL,
      \`created_at\` timestamp NOT NULL DEFAULT (now()),
      \`updated_at\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
      \`ip_address\` varchar(45),
      \`user_agent\` text,
      \`impersonated_by\` varchar(36),
      \`user_id\` varchar(36) NOT NULL,
      CONSTRAINT \`school_auth_sessions_id\` PRIMARY KEY (\`id\`),
      CONSTRAINT \`school_auth_sessions_token_unique\` UNIQUE (\`token\`),
      KEY \`school_auth_sessions_user_idx\` (\`user_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}
  `);
  try {
    await connection.query(
      "ALTER TABLE `school_auth_sessions` ADD CONSTRAINT `school_auth_sessions_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `school_auth_users`(`id`) ON DELETE CASCADE",
    );
  } catch (error) {
    // Sign-in works without it; the key only removes a deleted user's sessions automatically.
    console.warn("[migrate] could not add the session → user foreign key:", error instanceof Error ? error.message : error);
  }
  console.log("[migrate] created Forma's school_auth_sessions table.");
}

export async function repairMembershipsTable(connection) {
  const [columns] = await connection.query(
    "SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_memberships'",
  );
  if (!Array.isArray(columns) || columns.length === 0) {
    console.warn("[migrate] school_memberships is missing; creating it.");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`school_memberships\` (
        \`id\` varchar(36) NOT NULL,
        \`school_id\` varchar(36) NOT NULL,
        \`user_id\` varchar(36) NOT NULL,
        \`role\` enum('school_admin','teacher','student','guardian','inventory_manager','hr_manager','librarian','lab_technician','workshop_manager','community_officer','pr_officer') NOT NULL DEFAULT 'student',
        \`created_at\` timestamp NOT NULL DEFAULT (now()),
        \`updated_at\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`school_memberships_id\` PRIMARY KEY (\`id\`),
        CONSTRAINT \`school_memberships_school_user_unique\` UNIQUE (\`school_id\`, \`user_id\`),
        KEY \`school_memberships_user_idx\` (\`user_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("[migrate] created school_memberships table.");
  }
}

export async function repairInvitationsTable(connection) {
  const [columns] = await connection.query(
    "SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_invitations'",
  );
  if (!Array.isArray(columns) || columns.length === 0) {
    console.warn("[migrate] school_invitations is missing; creating it.");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`school_invitations\` (
        \`id\` varchar(36) NOT NULL,
        \`school_id\` varchar(36) NOT NULL,
        \`invited_by\` varchar(36) NOT NULL,
        \`email\` varchar(254) NOT NULL,
        \`role\` enum('school_admin','teacher','student','guardian','inventory_manager','hr_manager','librarian','lab_technician','workshop_manager','community_officer','pr_officer') NOT NULL,
        \`token_hash\` varchar(64) NOT NULL,
        \`expires_at\` timestamp NOT NULL,
        \`accepted_at\` timestamp,
        \`created_at\` timestamp NOT NULL DEFAULT (now()),
        CONSTRAINT \`school_invitations_id\` PRIMARY KEY (\`id\`),
        CONSTRAINT \`school_invitations_token_hash_unique\` UNIQUE (\`token_hash\`),
        KEY \`school_invitations_school_email_idx\` (\`school_id\`, \`email\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("[migrate] created school_invitations table.");
  }
}

export async function repairGradeLevelsTable(connection) {
  const [legacy] = await connection.query("SHOW TABLES LIKE 'grade_levels'");
  const [school] = await connection.query("SHOW TABLES LIKE 'school_grade_levels'");
  if (Array.isArray(legacy) && legacy.length > 0 && (!Array.isArray(school) || school.length === 0)) {
    console.log("[migrate] Renaming legacy grade_levels to school_grade_levels...");
    await connection.query("RENAME TABLE `grade_levels` TO `school_grade_levels`");
  } else if (!Array.isArray(school) || school.length === 0) {
    console.warn("[migrate] school_grade_levels is missing; creating it.");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`school_grade_levels\` (
        \`id\` varchar(36) NOT NULL,
        \`school_id\` varchar(36) NOT NULL,
        \`name\` varchar(80) NOT NULL,
        \`sort_order\` int NOT NULL DEFAULT 0,
        \`created_at\` timestamp NOT NULL DEFAULT (now()),
        CONSTRAINT \`school_grade_levels_id\` PRIMARY KEY (\`id\`),
        CONSTRAINT \`school_grade_levels_school_name_unique\` UNIQUE (\`school_id\`, \`name\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("[migrate] created school_grade_levels table.");
  }
}

export async function repairSubjectsTable(connection) {
  const [legacy] = await connection.query("SHOW TABLES LIKE 'subjects'");
  const [school] = await connection.query("SHOW TABLES LIKE 'school_subjects'");
  if (Array.isArray(legacy) && legacy.length > 0 && (!Array.isArray(school) || school.length === 0)) {
    console.log("[migrate] Renaming legacy subjects to school_subjects...");
    await connection.query("RENAME TABLE `subjects` TO `school_subjects`");
  } else if (!Array.isArray(school) || school.length === 0) {
    console.warn("[migrate] school_subjects is missing; creating it.");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`school_subjects\` (
        \`id\` varchar(36) NOT NULL,
        \`school_id\` varchar(36) NOT NULL,
        \`name\` varchar(120) NOT NULL,
        \`code\` varchar(30),
        \`department\` varchar(100),
        \`description\` text,
        \`created_at\` timestamp NOT NULL DEFAULT (now()),
        CONSTRAINT \`school_subjects_id\` PRIMARY KEY (\`id\`),
        CONSTRAINT \`school_subjects_school_name_unique\` UNIQUE (\`school_id\`, \`name\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("[migrate] created school_subjects table.");
  }
}

export async function repairLearningResourcesTable(connection) {
  const [legacy] = await connection.query("SHOW TABLES LIKE 'learning_resources'");
  const [school] = await connection.query("SHOW TABLES LIKE 'school_learning_resources'");
  if (Array.isArray(legacy) && legacy.length > 0 && (!Array.isArray(school) || school.length === 0)) {
    console.log("[migrate] Renaming legacy learning_resources to school_learning_resources...");
    await connection.query("RENAME TABLE `learning_resources` TO `school_learning_resources`");
  } else if (!Array.isArray(school) || school.length === 0) {
    console.warn("[migrate] school_learning_resources is missing; creating it.");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`school_learning_resources\` (
        \`id\` varchar(36) NOT NULL,
        \`school_id\` varchar(36) NOT NULL,
        \`uploaded_by\` varchar(36),
        \`title\` varchar(200) NOT NULL,
        \`description\` text,
        \`file_name\` varchar(255) NOT NULL,
        \`storage_key\` varchar(36) NOT NULL,
        \`content_type\` varchar(120) NOT NULL,
        \`size_bytes\` int NOT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT (now()),
        CONSTRAINT \`school_learning_resources_id\` PRIMARY KEY (\`id\`),
        CONSTRAINT \`school_learning_resources_storage_key_unique\` UNIQUE (\`storage_key\`),
        KEY \`school_learning_resources_school_created_idx\` (\`school_id\`, \`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("[migrate] created school_learning_resources table.");
  }

  // If grade_level_id already exists in school_learning_resources, migration 0008 was already applied!
  try {
    const [cols] = await connection.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_learning_resources' AND COLUMN_NAME = 'grade_level_id'",
    );
    if (Array.isArray(cols) && cols.length > 0) {
      await connection.query(
        "INSERT IGNORE INTO `school_drizzle_migrations` (`id`, `hash`, `created_at`) VALUES (?, ?, ?)",
        [9, "00c12bd9b2784915b7f626bdd05db9e045381d791d9805fd5abc1943922f3447", 1792664700000],
      );
    }
  } catch (err) {
    console.warn("[migrate] Notice checking grade_level_id column:", err instanceof Error ? err.message : err);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runMigrations().catch(() => {
    process.exitCode = 1;
  });
}
