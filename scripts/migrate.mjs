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

const DEFAULT_COLLATION = "utf8mb4_unicode_ci";
const ROLE_ENUM =
  "enum('school_admin','teacher','student','guardian','inventory_manager','hr_manager'," +
  "'librarian','lab_technician','workshop_manager','community_officer','pr_officer')";

export async function tableExists(connection, name) {
  const [rows] = await connection.query("SHOW TABLES LIKE ?", [name]);
  return Array.isArray(rows) && rows.length > 0;
}

export async function tableColumns(connection, name) {
  const [rows] = await connection.query(
    `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [name],
  );
  return new Set(Array.isArray(rows) ? rows.map((r) => r.name) : []);
}

/** Creates `name` from `ddl` if absent. Returns true when it created the table. */
export async function ensureTable(connection, name, ddl) {
  if (await tableExists(connection, name)) return false;
  console.log(`[migrate] ${name} is missing; creating it.`);
  await connection.query(ddl);
  console.log(`[migrate] created ${name} table.`);
  return true;
}

export async function renameLegacyTable(connection, oldName, newName, allowRename) {
  if (!allowRename) {
    if (await tableExists(connection, oldName)) {
      console.warn(
        `[migrate] legacy table ${oldName} found but renames are disabled; ` +
        `set FORMA_RENAME_LEGACY_TABLES=1 if this database holds only Forma's tables.`,
      );
    }
    return false;
  }
  if (!(await tableExists(connection, oldName))) return false;
  if (await tableExists(connection, newName)) return false;

  await connection.query("SET FOREIGN_KEY_CHECKS = 0");
  try {
    await connection.query(`RENAME TABLE \`${oldName}\` TO \`${newName}\``);
    console.log(`[migrate] Renamed legacy table ${oldName} to ${newName}`);
    return true;
  } catch (err) {
    console.warn(`[migrate] Notice on renaming ${oldName}:`, err instanceof Error ? err.message : err);
    return false;
  } finally {
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
  }
}

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
  { id: 1,  hash: "9972594da7af2abc62d5794dfc037c611264e112bf578735189435685d5edf0b", created_at: 1792139085116 },
  { id: 2,  hash: "8c010babc91a22d6298fd06f8d8131c725f447b6f0b85455ce8b7f24467c1e85", created_at: 1792143444042 },
  { id: 3,  hash: "9c0bdf6c3fb0e4400345f349202aea86e386b7e32052cc3c1da2d4ccbbaa8071", created_at: 1792161069647 },
  { id: 4,  hash: "0430b5c437ab19471bbb860f6e1245f4dfabdcea842d82e5df951ff6d5810a0e", created_at: 1792169009545 },
  { id: 5,  hash: "743a5ed5dbb640398bfc7f09c22918c1aeaaebfb5c386daa47657dead359aa85", created_at: 1792171617523 },
  { id: 6,  hash: "6d6bd067a2ce7b8bd89a674a417a89ea8145fd8505d2053acbe0937b7a446444", created_at: 1792173766181 },
  { id: 7,  hash: "f7cefd21c1a7475c0a3c4ab7fb2d0816cb8687d420939311eafad33ca46df767", created_at: 1792429587063 },
  { id: 8,  hash: "a263c48daac6b488e1a01c3c6329bc598ae7e5dcfdc0afb33a6698d05f81e4c3", created_at: 1792663148980 },
  { id: 9,  hash: "00c12bd9b2784915b7f626bdd05db9e045381d791d9805fd5abc1943922f3447", created_at: 1792664700000 },
  // idx 9–15: hashes are SHA-256 of the SQL file content (as computed by drizzle-orm/migrator.js)
  { id: 10, hash: "d2e9d13068160ac4a7ec5de05635df907772d1890b6f263e90f4a3bb58b4dd38", created_at: 1792669291424 },
  { id: 11, hash: "c15114d48c81953fcd120e11cea9ae97d7ce14fce9c941d84184631d2c47eda1", created_at: 1792669907271 },
  { id: 12, hash: "73b5eae6b2336606de71506e4583a698e2599c6b6d0fd3a7270212747f2d0028", created_at: 1792670596829 },
  { id: 13, hash: "879e762ab53fe03e3ee2e3faabcd2d9a8f686eb789a49210ca171cf40cb6882f", created_at: 1792671006939 },
  { id: 14, hash: "15c2bb93c9b9de78e482debe34e8cceb171dcdae78f6ca0f532f339bbc25adf2", created_at: 1792671177678 },
  { id: 15, hash: "621773deb86c1aefbd3652db2b4c9ffed6f2b70b55012f617405ea83b9f8edc5", created_at: 1792671440949 },
  { id: 16, hash: "9bcb350168758b60523ee5efe6581471368304f37de8886d3e8dc86b98272410", created_at: 1792671647283 },
];

/** Seeds a known-good migration history entry. Used when the schema already reflects it. */
async function seedMigration(connection, id) {
  const m = knownMigrations.find((entry) => entry.id === id);
  if (!m) throw new Error(`[migrate] no known migration with id ${id}`);
  await connection.query(
    "INSERT IGNORE INTO `school_drizzle_migrations` (`id`, `hash`, `created_at`) VALUES (?, ?, ?)",
    [m.id, m.hash, m.created_at],
  );
}

export async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    throw new Error("[migrate] DATABASE_URL is not set.");
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

    // 2. Rename legacy unprefixed tables to the school_ prefix — only when explicitly allowed.
    const allowRename = process.env.FORMA_RENAME_LEGACY_TABLES === "1";
    for (const [oldName, newName] of tablesToRename) {
      await renameLegacyTable(connection, oldName, newName, allowRename);
    }

    // 3. Inspect if our tables actually exist.
    try {
      const hasSchoolAuthUsers = await tableExists(connection, "school_auth_users");
      const hasLegacyAuthUsers = await tableExists(connection, "auth_users");

      if (!hasSchoolAuthUsers && !hasLegacyAuthUsers) {
        const [existingMigrations] = await connection.query("SELECT COUNT(*) AS count FROM `school_drizzle_migrations`");
        const migrationCount = Number(existingMigrations[0]?.count ?? 0);
        if (migrationCount > 0) {
          console.warn(`[migrate] Stale migration records found (${migrationCount}) but school_auth_users is missing. Resetting migration table...`);
          await connection.query("DELETE FROM `school_drizzle_migrations`");
        }
      } else if (hasSchoolAuthUsers) {
        // Our tables exist with the school_ prefix — seed migration history 1..8 so Drizzle
        // does not try to re-run migrations that already produced this baseline.
        for (const m of knownMigrations.filter((entry) => entry.id <= 8)) {
          await seedMigration(connection, m.id);
        }

        // Ensure prerequisite tables exist before running later migrations (since migrations 0000..0007 were skipped)
        await repairMembershipsTable(connection);
        await repairInvitationsTable(connection);
        await repairGradeLevelsTable(connection, allowRename);
        await repairSubjectsTable(connection, allowRename);
        await repairLearningResourcesTable(connection, allowRename);

        // Seed any later migrations (idx 8–15) whose tables/columns already exist on the DB
        // so Drizzle does not try to replay them and fail with "duplicate column/table".
        await seedAppliedMigrations(connection);
      }
    } catch (e) {
      console.warn("[migrate] Warning inspecting existing migration state:", e instanceof Error ? e.message : e);
    }

    // 4. Run Drizzle migration engine
    await migrate(drizzle(connection), {
      migrationsFolder: path.join(root, "drizzle"),
      migrationsTable: "school_drizzle_migrations",
    });

    // 5. Make sure the session table is Forma's own and has required keys.
    await repairSessionTable(connection);

    let applied = 0;
    try {
      const [rows] = await connection.query("SELECT COUNT(*) AS applied FROM `school_drizzle_migrations`");
      applied = Number(rows[0]?.applied ?? 0);
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

export async function repairMembershipsTable(connection) {
  await ensureTable(connection, "school_memberships", `
    CREATE TABLE IF NOT EXISTS \`school_memberships\` (
      \`id\` varchar(36) NOT NULL,
      \`school_id\` varchar(36) NOT NULL,
      \`user_id\` varchar(36) NOT NULL,
      \`role\` ${ROLE_ENUM} NOT NULL DEFAULT 'student',
      \`created_at\` timestamp NOT NULL DEFAULT (now()),
      \`updated_at\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT \`school_memberships_id\` PRIMARY KEY (\`id\`),
      CONSTRAINT \`school_memberships_school_user_unique\` UNIQUE (\`school_id\`, \`user_id\`),
      KEY \`school_memberships_user_idx\` (\`user_id\`),
      KEY \`school_memberships_school_idx\` (\`school_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=${DEFAULT_COLLATION}
  `);
}

export async function repairInvitationsTable(connection) {
  await ensureTable(connection, "school_invitations", `
    CREATE TABLE IF NOT EXISTS \`school_invitations\` (
      \`id\` varchar(36) NOT NULL,
      \`school_id\` varchar(36) NOT NULL,
      \`invited_by\` varchar(36) NOT NULL,
      \`email\` varchar(254) NOT NULL,
      \`role\` ${ROLE_ENUM} NOT NULL,
      \`token_hash\` varchar(64) NOT NULL,
      \`expires_at\` timestamp NOT NULL,
      \`accepted_at\` timestamp,
      \`created_at\` timestamp NOT NULL DEFAULT (now()),
      CONSTRAINT \`school_invitations_id\` PRIMARY KEY (\`id\`),
      CONSTRAINT \`school_invitations_token_hash_unique\` UNIQUE (\`token_hash\`),
      KEY \`school_invitations_school_email_idx\` (\`school_id\`, \`email\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=${DEFAULT_COLLATION}
  `);
}

export async function repairGradeLevelsTable(connection, allowRename = false) {
  await renameLegacyTable(connection, "grade_levels", "school_grade_levels", allowRename);
  await ensureTable(connection, "school_grade_levels", `
    CREATE TABLE IF NOT EXISTS \`school_grade_levels\` (
      \`id\` varchar(36) NOT NULL,
      \`school_id\` varchar(36) NOT NULL,
      \`name\` varchar(80) NOT NULL,
      \`sort_order\` int NOT NULL DEFAULT 0,
      \`created_at\` timestamp NOT NULL DEFAULT (now()),
      CONSTRAINT \`school_grade_levels_id\` PRIMARY KEY (\`id\`),
      CONSTRAINT \`school_grade_levels_school_name_unique\` UNIQUE (\`school_id\`, \`name\`),
      KEY \`school_grade_levels_school_idx\` (\`school_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=${DEFAULT_COLLATION}
  `);
}

export async function repairSubjectsTable(connection, allowRename = false) {
  await renameLegacyTable(connection, "subjects", "school_subjects", allowRename);
  await ensureTable(connection, "school_subjects", `
    CREATE TABLE IF NOT EXISTS \`school_subjects\` (
      \`id\` varchar(36) NOT NULL,
      \`school_id\` varchar(36) NOT NULL,
      \`name\` varchar(120) NOT NULL,
      \`code\` varchar(30),
      \`department\` varchar(100),
      \`description\` text,
      \`created_at\` timestamp NOT NULL DEFAULT (now()),
      CONSTRAINT \`school_subjects_id\` PRIMARY KEY (\`id\`),
      CONSTRAINT \`school_subjects_school_name_unique\` UNIQUE (\`school_id\`, \`name\`),
      KEY \`school_subjects_school_idx\` (\`school_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=${DEFAULT_COLLATION}
  `);
}

export async function repairLearningResourcesTable(connection, allowRename = false) {
  await renameLegacyTable(connection, "learning_resources", "school_learning_resources", allowRename);
  await ensureTable(connection, "school_learning_resources", `
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=${DEFAULT_COLLATION}
  `);

  const lrCols = await tableColumns(connection, "school_learning_resources");
  // If grade_level_id already exists → migration 0008 (id=9) was already applied
  if (lrCols.has("grade_level_id")) {
    await seedMigration(connection, 9);
  }
  // If catalog_entry_id already exists → migration 0009 (id=10) was already applied
  if (lrCols.has("catalog_entry_id")) {
    await seedMigration(connection, 10);
  }
  // If ai_file_id already exists → migration 0010 (id=11) was already applied
  if (lrCols.has("ai_file_id")) {
    await seedMigration(connection, 11);
  }
}

/**
 * Detects which post-baseline migrations (idx 8–15, id 9–16) are already reflected
 * in the live database and seeds their history entries so Drizzle won't replay them.
 * Safe to call multiple times — INSERT IGNORE makes it idempotent.
 */
export async function seedAppliedMigrations(connection) {
  // idx=8 / id=9  — 0008_link_resources_grade_subject
  //   Adds: school_learning_resources.grade_level_id, subject_id
  if ((await tableColumns(connection, "school_learning_resources")).has("grade_level_id")) {
    await seedMigration(connection, 9);
  }

  // idx=9 / id=10 — 0009_textbook_catalog
  //   Creates: school_textbook_catalog; adds: school_learning_resources.catalog_entry_id
  if (await tableExists(connection, "school_textbook_catalog")) {
    await seedMigration(connection, 10);
  }

  // idx=10 / id=11 — 0010_ai_materials
  //   Creates: school_generated_materials; adds: school_learning_resources.ai_file_id
  if (await tableExists(connection, "school_generated_materials")) {
    await seedMigration(connection, 11);
  }

  // idx=11 / id=12 — 0011_roles_and_hr
  //   Creates: school_staff_attendance, school_staff_contracts, school_staff_leave
  if (await tableExists(connection, "school_staff_attendance")) {
    await seedMigration(connection, 12);
  }

  // idx=12 / id=13 — 0012_library
  //   Creates: school_library_books, school_library_loans
  if (await tableExists(connection, "school_library_books")) {
    await seedMigration(connection, 13);
  }

  // idx=13 / id=14 — 0013_facilities
  //   Creates: school_facilities, school_facility_bookings, school_facility_items, school_facility_logs
  if (await tableExists(connection, "school_facilities")) {
    await seedMigration(connection, 14);
  }

  // idx=14 / id=15 — 0014_community
  //   Creates: school_community_events, school_community_partners, school_volunteers
  if (await tableExists(connection, "school_community_partners")) {
    await seedMigration(connection, 15);
  }

  // idx=15 / id=16 — 0015_public_relations
  //   Creates: school_pr_media, school_pr_posts, school_public_profiles
  if (await tableExists(connection, "school_pr_media")) {
    await seedMigration(connection, 16);
  }
}

/**
 * On the shared production database, school_auth_sessions ended up being the other application's
 * session table (token_hash, last_seen_at, datetime columns) instead of Forma's, so every sign-in
 * failed when it saved the session. If the table lacks Forma's columns, move it aside under a
 * dated name — keeping its rows — and create Forma's table; if it is missing, create it.
 */
export async function repairSessionTable(connection) {
  const existing = await tableColumns(connection, "school_auth_sessions");
  const required = [
    "id", "expires_at", "token", "created_at", "updated_at",
    "ip_address", "user_agent", "impersonated_by", "user_id",
  ];

  const [userTable] = await connection.query(
    "SELECT TABLE_COLLATION AS collation FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_auth_users'",
  );
  const collation = /^[a-z0-9_]+$/.test(userTable?.[0]?.collation ?? "") ? userTable[0].collation : DEFAULT_COLLATION;
  const charset = collation.split("_")[0];

  const createSessionDdl = `
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
      KEY \`school_auth_sessions_user_idx\` (\`user_id\`),
      KEY \`school_auth_sessions_expires_idx\` (\`expires_at\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}
  `;

  if (existing.size === 0) {
    console.log("[migrate] school_auth_sessions is missing; creating it.");
    await connection.query(createSessionDdl);
    console.log("[migrate] created Forma's school_auth_sessions table.");
  } else if (!required.every((name) => existing.has(name))) {
    const stamp = new Date().toISOString().slice(0, 19).replace(/\D/g, "");
    const asideName = `school_auth_sessions_foreign_${stamp}`;
    console.warn(`[migrate] school_auth_sessions is not Forma's session table; moving it to ${asideName}.`);
    await connection.query(`RENAME TABLE \`school_auth_sessions\` TO \`${asideName}\``);
    await connection.query(createSessionDdl);
    console.log("[migrate] recreated Forma's school_auth_sessions table.");
  }

  // Re-entrant FK check: verify constraint exists independently of table creation
  const [fk] = await connection.query(
    `SELECT CONSTRAINT_NAME AS name FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_auth_sessions'
        AND CONSTRAINT_TYPE = 'FOREIGN KEY' AND CONSTRAINT_NAME = 'school_auth_sessions_user_id_fk'`,
  );
  if (!Array.isArray(fk) || fk.length === 0) {
    try {
      await connection.query(
        "ALTER TABLE `school_auth_sessions` ADD CONSTRAINT `school_auth_sessions_user_id_fk` " +
        "FOREIGN KEY (`user_id`) REFERENCES `school_auth_users`(`id`) ON DELETE CASCADE",
      );
    } catch (error) {
      console.warn("[migrate] could not add the session → user foreign key:", error instanceof Error ? error.message : error);
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runMigrations().catch(() => {
    process.exitCode = 1;
  });
}
