import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, resolve } from "node:path";
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
      const [rows] = await db.query<mysql.RowDataPacket[]>("SELECT COUNT(*) AS applied FROM `__drizzle_migrations`");
      applied = Number(rows[0]?.applied ?? 0);
    } catch {
      applied = 0;
    }
    let expected: number | null = null;
    try {
      const journal = JSON.parse(await readFile(join(/* turbopackIgnore: true */ process.cwd(), "drizzle", "meta", "_journal.json"), "utf8"));
      expected = Array.isArray(journal.entries) ? journal.entries.length : null;
    } catch {
      expected = null;
    }
    const migrated = expected === null ? applied > 0 : applied >= expected;
    return {
      ok: migrated,
      migrations: { applied, expected },
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

export async function GET() {
  await connection();
  const [settings, database, uploads, release, envFile] = await Promise.all([
    Promise.resolve(checkSettings()),
    checkDatabase(),
    checkUploads(),
    readRelease(),
    hasEnvFile(),
  ]);
  const ok = settings.ok && database.ok && uploads.ok;
  return Response.json(
    {
      status: ok ? "ok" : "error",
      release,
      settings: { ...settings, envFileBesideApp: envFile },
      database,
      uploads,
      time: new Date().toISOString(),
    },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
