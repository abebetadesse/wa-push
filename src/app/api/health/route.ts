import { access, readFile } from "node:fs/promises";
import { constants, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import mysql from "mysql2/promise";
import { connection } from "next/server";

// Public deployment check: reports which settings are missing and whether the database is ready,
// without revealing any values. It deliberately does not import @/lib/auth or @/db, which throw at
// start-up when their settings are missing; that failure is exactly what this route must report.

const databaseErrors: Record<string, string> = {
  ER_ACCESS_DENIED_ERROR: "The database rejected the username or password in DATABASE_URL.",
  ER_DBACCESS_DENIED_ERROR: "The database user has no access to the database in DATABASE_URL.",
  ER_BAD_DB_ERROR: "The database named in DATABASE_URL does not exist.",
  ECONNREFUSED: "Nothing is accepting connections at the database host and port in DATABASE_URL.",
  ENOTFOUND: "The database host in DATABASE_URL could not be found.",
  ETIMEDOUT: "Connecting to the database host in DATABASE_URL timed out.",
};

function checkSettings() {
  const missing: string[] = [];
  const problems: string[] = [];
  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  if (!secret) missing.push("BETTER_AUTH_SECRET");
  else if (secret.length < 32) problems.push("BETTER_AUTH_SECRET must be at least 32 characters.");

  const authUrl = process.env.BETTER_AUTH_URL ?? "";
  if (!authUrl) missing.push("BETTER_AUTH_URL");
  else {
    try {
      const url = new URL(authUrl);
      if (url.pathname !== "/" && url.pathname !== "") {
        problems.push("BETTER_AUTH_URL must be the public origin only, without a path such as /school.");
      }
      if (url.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
        problems.push("BETTER_AUTH_URL must use https://.");
      }
    } catch {
      problems.push("BETTER_AUTH_URL is not a valid URL.");
    }
  }

  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  for (const name of ["SMTP_HOST", "SMTP_PORT", "EMAIL_FROM"]) {
    if (!process.env[name]) missing.push(name);
  }
  if (Boolean(process.env.SMTP_USER) !== Boolean(process.env.SMTP_PASSWORD)) {
    problems.push("Set both SMTP_USER and SMTP_PASSWORD, or neither.");
  }
  return { ok: missing.length === 0 && problems.length === 0, missing, problems };
}

async function checkDatabase() {
  if (!process.env.DATABASE_URL) return { ok: false, error: "DATABASE_URL is not set." };
  let db: mysql.Connection | undefined;
  try {
    db = await mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 5000 });
    let applied = 0;
    try {
      const [rows] = await db.query<mysql.RowDataPacket[]>("SELECT COUNT(*) AS applied FROM `school_drizzle_migrations`");
      applied = Number(rows[0]?.applied ?? 0);
    } catch {
      try {
        const [rows] = await db.query<mysql.RowDataPacket[]>("SELECT COUNT(*) AS applied FROM `__drizzle_migrations`");
        applied = Number(rows[0]?.applied ?? 0);
      } catch {
        applied = 0;
      }
    }
    let expected: number | null = null;
    try {
      const journal = JSON.parse(await readFile(join(/* turbopackIgnore: true */ process.cwd(), "drizzle", "meta", "_journal.json"), "utf8"));
      expected = Array.isArray(journal.entries) ? journal.entries.length : null;
    } catch {
      expected = null;
    }
    let migrated = expected === null ? applied > 0 : applied >= expected;
    if (!migrated) {
      try {
        const migrateScript = join(/* turbopackIgnore: true */ process.cwd(), "scripts", "migrate.mjs");
        if (existsSync(migrateScript)) {
          const { runMigrations } = await import(/* turbopackIgnore: true */ pathToFileURL(migrateScript).href);
          if (typeof runMigrations === "function") {
            await runMigrations();
            const [newRows] = await db.query<mysql.RowDataPacket[]>("SELECT COUNT(*) AS applied FROM `school_drizzle_migrations`");
            applied = Number(newRows[0]?.applied ?? 0);
            migrated = expected === null ? applied > 0 : applied >= expected;
          }
        }
      } catch {
        // If auto-migration threw, error is reported below
      }
    }
    let tables: string[] = [];
    try {
      const [tableRows] = await db.query<mysql.RowDataPacket[]>("SHOW TABLES");
      tables = tableRows.map((r) => Object.values(r)[0] as string);
    } catch {
      tables = [];
    }
    const startupMigration = (globalThis as unknown as { __migrationStatus?: unknown }).__migrationStatus;
    return {
      ok: migrated,
      migrations: { applied, expected },
      startupMigration,
      tablesCount: tables.length,
      sampleTables: tables.slice(0, 10),
      ...(migrated ? {} : { error: "Database tables are missing or out of date: run the db:migrate script." }),
    };
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    return { ok: false, error: databaseErrors[code] ?? `Could not connect to the database${code ? ` (${code})` : ""}.` };
  } finally {
    await db?.end().catch(() => undefined);
  }
}

async function checkUploads() {
  const configured = process.env.UPLOAD_DIR?.trim();
  const root = configured
    ? resolve(/* turbopackIgnore: true */ configured)
    : join(/* turbopackIgnore: true */ process.cwd(), "var", "uploads");
  // Folders are created on first upload, so the nearest existing folder must be writable.
  let candidate = root;
  for (;;) {
    try {
      await access(candidate, constants.F_OK);
      break;
    } catch {
      const parent = dirname(candidate);
      if (parent === candidate) break;
      candidate = parent;
    }
  }
  try {
    await access(candidate, constants.W_OK);
    return { ok: true, configured: Boolean(configured) };
  } catch {
    return { ok: false, configured: Boolean(configured), error: "The upload folder (UPLOAD_DIR) cannot be created or written to." };
  }
}

// Which release is running, from RELEASE.json written by npm run deploy:plesk (absent in development).
async function readRelease() {
  try {
    const release = JSON.parse(await readFile(join(/* turbopackIgnore: true */ process.cwd(), "RELEASE.json"), "utf8"));
    return { commit: String(release.commit ?? ""), basePath: String(release.basePath ?? ""), builtAt: String(release.builtAt ?? "") };
  } catch {
    return null;
  }
}

// Whether a .env file sits beside the app (yes/no only), to tell "settings saved in the wrong place"
// apart from "settings never saved" when nothing is configured.
async function hasEnvFile() {
  const candidates = [".env", ".env.local", ".env.production", ".env.production.local"];
  for (const name of candidates) {
    try {
      await access(join(/* turbopackIgnore: true */ process.cwd(), name), constants.R_OK);
      return true;
    } catch {
      // Continue to next candidate
    }
  }
  return false;
}

// Columns the sign-in tables must have, as defined in src/db/schema.ts: [name, type, max length].
const authTableColumns: Record<string, [string, string, number?][]> = {
  school_auth_users: [["id", "varchar", 36], ["name", "varchar", 255], ["email", "varchar", 255], ["email_verified", "tinyint"], ["image", "text"], ["role", "varchar", 255], ["banned", "tinyint"], ["ban_reason", "text"], ["ban_expires", "timestamp"], ["created_at", "timestamp"], ["updated_at", "timestamp"]],
  school_auth_sessions: [["id", "varchar", 36], ["expires_at", "timestamp"], ["token", "varchar", 255], ["created_at", "timestamp"], ["updated_at", "timestamp"], ["ip_address", "varchar", 45], ["user_agent", "text"], ["impersonated_by", "varchar", 36], ["user_id", "varchar", 36]],
  school_auth_accounts: [["id", "varchar", 36], ["account_id", "varchar", 255], ["provider_id", "varchar", 100], ["user_id", "varchar", 36], ["access_token", "text"], ["refresh_token", "text"], ["id_token", "text"], ["access_token_expires_at", "timestamp"], ["refresh_token_expires_at", "timestamp"], ["scope", "text"], ["password", "text"], ["created_at", "timestamp"], ["updated_at", "timestamp"]],
  school_auth_verifications: [["id", "varchar", 36], ["identifier", "varchar", 255], ["value", "text"], ["expires_at", "timestamp"], ["created_at", "timestamp"], ["updated_at", "timestamp"]],
};

/**
 * Sign-in writes a row to school_auth_sessions. Report, without values, how the sign-in tables differ
 * from what the app expects, and try that write for an administrator inside a transaction that is
 * always rolled back, so a failing sign-in shows its database error here.
 */
async function checkAuthTables() {
  if (!process.env.DATABASE_URL) return { ok: false, error: "DATABASE_URL is not set." };
  let db: mysql.Connection | undefined;
  try {
    db = await mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 5000 });
    const [columns] = await db.query<mysql.RowDataPacket[]>(
      `SELECT TABLE_NAME AS t, COLUMN_NAME AS c, DATA_TYPE AS type, CHARACTER_MAXIMUM_LENGTH AS len,
              IS_NULLABLE AS nullable, COLUMN_DEFAULT AS def, EXTRA AS extra
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?)`,
      [Object.keys(authTableColumns)],
    );
    const problems: string[] = [];
    for (const [table, expected] of Object.entries(authTableColumns)) {
      const actual = columns.filter((column) => column.t === table);
      if (actual.length === 0) {
        problems.push(`${table} is missing.`);
        continue;
      }
      for (const [name, type, length] of expected) {
        const column = actual.find((candidate) => candidate.c === name);
        if (!column) problems.push(`${table}.${name} is missing.`);
        else if (String(column.type) !== type) problems.push(`${table}.${name} is ${column.type}, expected ${type}.`);
        else if (length && Number(column.len) < length) problems.push(`${table}.${name} holds ${column.len} characters, expected ${length}.`);
      }
      // A required column the app doesn't know about makes every insert fail.
      for (const column of actual) {
        const known = expected.some(([name]) => name === column.c);
        if (!known && column.nullable === "NO" && column.def === null && !String(column.extra).includes("auto_increment")) {
          problems.push(`${table}.${column.c} is required but unknown to the app.`);
        }
      }
    }

    const [lengths] = await db.query<mysql.RowDataPacket[]>(
      "SELECT MAX(CHAR_LENGTH(id)) AS userIdLength, SUM(role LIKE '%admin%') AS admins FROM school_auth_users",
    ).catch(() => [[{}] as mysql.RowDataPacket[]]);
    const userIdLength = Number(lengths[0]?.userIdLength ?? 0);
    if (userIdLength > 36) problems.push(`Some user IDs are ${userIdLength} characters, longer than the 36 sessions can store.`);

    let sessionWrite: { ok: boolean; code?: string; error?: string; skipped?: string } = { ok: false, skipped: "No administrator found." };
    const [admins] = await db.query<mysql.RowDataPacket[]>(
      "SELECT id FROM school_auth_users WHERE role LIKE '%admin%' LIMIT 1",
    ).catch(() => [[] as mysql.RowDataPacket[]]);
    if (admins[0]?.id) {
      await db.beginTransaction();
      try {
        const token = `health-check-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await db.query(
          `INSERT INTO school_auth_sessions (id, expires_at, token, created_at, updated_at, ip_address, user_agent, user_id)
           VALUES (?, DATE_ADD(NOW(), INTERVAL 1 MINUTE), ?, NOW(), NOW(), ?, ?, ?)`,
          ["healthcheck00000000000000000000x", token, "203.0.113.10", "forma-health-check", admins[0].id],
        );
        sessionWrite = { ok: true };
      } catch (error) {
        const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
        sessionWrite = { ok: false, code, error: error instanceof Error ? error.message : String(error) };
      } finally {
        await db.rollback().catch(() => {});
      }
    }

    return {
      ok: problems.length === 0 && sessionWrite.ok,
      problems,
      administrators: Number(lengths[0]?.admins ?? 0),
      sessionWrite,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    await db?.end().catch(() => {});
  }
}

export async function GET() {
  await connection();
  const [settings, database, uploads, release, envFile, auth] = await Promise.all([
    Promise.resolve(checkSettings()),
    checkDatabase(),
    checkUploads(),
    readRelease(),
    hasEnvFile(),
    checkAuthTables(),
  ]);
  const ok = settings.ok && database.ok && uploads.ok && auth.ok;
  return Response.json(
    {
      status: ok ? "ok" : "error",
      release,
      settings: { ...settings, envFileBesideApp: envFile },
      database,
      auth,
      uploads,
      time: new Date().toISOString(),
    },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
