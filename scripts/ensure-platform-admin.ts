/**
 * Creates or promotes a platform administrator.
 *
 * Unlike create-platform-admin.ts, this script:
 *   - Works even when users already exist in the database.
 *   - If the email already has an account, it promotes it to admin role.
 *   - If no account exists, it creates one and sets admin role.
 *   - Accepts passwords as short as 8 characters (minimum for admin setup).
 *
 * Usage (interactive password prompt):
 *   npm run auth:ensure-admin -- --email abebetadesse1@gmail.com --name "Abebe Tadesse"
 *
 * Usage (non-interactive, e.g. Plesk "Run script" with env var):
 *   Set PLATFORM_ADMIN_PASSWORD in environment, then run the script above.
 */
import { loadEnvConfig } from "@next/env";
import { stdin, stdout } from "node:process";
import type { RowDataPacket } from "mysql2";

loadEnvConfig(process.cwd());

function getArgument(name: string) {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const parts: string[] = [];
  for (let i = index + 1; i < process.argv.length; i++) {
    if (process.argv[i]?.startsWith("--")) break;
    parts.push(process.argv[i]);
  }
  return parts.length > 0 ? parts.join(" ").trim() : undefined;
}

function readSecret(prompt: string) {
  if (!stdin.isTTY) {
    throw new Error(
      "No interactive terminal detected. Please pass --password <your_password> or set PLATFORM_ADMIN_PASSWORD in environment.",
    );
  }

  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  return new Promise<string>((resolve, reject) => {
    let value = "";
    let completed = false;
    const onEnd = () => finish(new Error("Password input ended unexpectedly."));

    const finish = (error?: Error) => {
      if (completed) return;
      completed = true;
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
      stdin.off("end", onEnd);
      stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };

    const onData = (input: string) => {
      for (const character of input) {
        if (character === "\u0003") {
          finish(new Error("Password entry cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = [...value].slice(0, -1).join("");
        } else if (character >= " ") {
          value += character;
        }
      }
    };

    stdin.on("data", onData);
    stdin.on("end", onEnd);
  });
}

async function main() {
  const email = getArgument("--email")?.toLowerCase();
  const name = getArgument("--name");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name || name.length > 255) {
    throw new Error(
      "Usage: npm run auth:ensure-admin -- --email admin@example.com --name \"Platform Admin\" [--password secret]",
    );
  }

  const passwordFromArg = getArgument("--password");
  const passwordFromEnvironment = process.env.PLATFORM_ADMIN_PASSWORD;
  delete process.env.PLATFORM_ADMIN_PASSWORD;
  const password =
    passwordFromArg ??
    passwordFromEnvironment ??
    (await readSecret("Platform-admin password (input hidden): "));
  if (!passwordFromArg && !passwordFromEnvironment) {
    const confirmation = await readSecret("Confirm password (input hidden): ");
    if (password !== confirmation) throw new Error("Passwords do not match.");
  }
  if (password.length < 8 || password.length > 128) {
    throw new Error("Password must be between 8 and 128 characters.");
  }

  const databaseUrl = process.env.DATABASE_URL;
  const authSecret = process.env.BETTER_AUTH_SECRET;
  const authBaseUrl = process.env.BETTER_AUTH_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  if (!authSecret || authSecret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be configured with at least 32 characters.");
  }
  if (!authBaseUrl) throw new Error("BETTER_AUTH_URL is required.");
  if (process.env.NODE_ENV === "production" && new URL(authBaseUrl).protocol !== "https:") {
    throw new Error("BETTER_AUTH_URL must use HTTPS in production.");
  }

  const { default: mysql } = await import("mysql2/promise");
  const { drizzleAdapter } = await import("@better-auth/drizzle-adapter");
  const { betterAuth } = await import("better-auth");
  const { admin } = await import("better-auth/plugins");
  const { drizzle } = await import("drizzle-orm/mysql2");
  const schema = await import("../src/db/schema");
  const connection = await mysql.createConnection(databaseUrl);
  const pool = mysql.createPool(databaseUrl);

  try {
    // Check and rename legacy tables to school_ prefix if needed
    const tablesToRename: [string, string][] = [
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

    for (const [oldName, newName] of tablesToRename) {
      try {
        const [oldRows] = await connection.query<RowDataPacket[]>(`SHOW TABLES LIKE '${oldName}'`);
        const [newRows] = await connection.query<RowDataPacket[]>(`SHOW TABLES LIKE '${newName}'`);
        if (oldRows.length > 0 && newRows.length === 0) {
          await connection.query(`RENAME TABLE \`${oldName}\` TO \`${newName}\``);
          console.info(`✓ Renamed legacy table ${oldName} to ${newName}`);
        }
      } catch {
        // Table might not exist or already renamed
      }
    }

    // Check if school_auth_users exists; if not, apply migrations
    const [checkUsersTable] = await connection.query<RowDataPacket[]>(
      "SHOW TABLES LIKE 'school_auth_users'",
    );
    if (!checkUsersTable || checkUsersTable.length === 0) {
      console.info("school_auth_users table does not exist. Running database migrations...");
      const { migrate } = await import("drizzle-orm/mysql2/migrator");
      const path = await import("node:path");
      await migrate(drizzle(connection), {
        migrationsFolder: path.join(process.cwd(), "drizzle"),
        migrationsTable: "school_drizzle_migrations",
      });
      console.info("✓ Migrations applied successfully.");
    }

    const db = drizzle(pool, { schema, mode: "default" });
    const auth = betterAuth({
      appName: "Forma",
      baseURL: authBaseUrl,
      secret: authSecret,
      database: drizzleAdapter(db, {
        provider: "mysql",
        schema: {
          user: schema.authUsers,
          session: schema.authSessions,
          account: schema.authAccounts,
          verification: schema.authVerifications,
        },
      }),
      emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        maxPasswordLength: 128,
      },
      plugins: [admin({ defaultRole: "user", adminRoles: ["admin"] })],
    });

    // Check whether this email already has an account.
    const [existingRows] = await connection.query<RowDataPacket[]>(
      "SELECT id, role FROM school_auth_users WHERE email = ? LIMIT 1",
      [email],
    );
    const existing = existingRows[0];

    if (existing) {
      // User exists — promote to admin and reset password via the admin plugin.
      console.info(`Found existing account for ${email} (id: ${existing.id}). Updating role and password…`);

      await auth.api.adminUpdateUser({
        body: { userId: existing.id as string, data: { role: "admin", name } },
      });

      await auth.api.setUserPassword({
        body: { userId: existing.id as string, newPassword: password },
      });

      const [updated] = await connection.query<RowDataPacket[]>(
        "SELECT role FROM school_auth_users WHERE id = ? LIMIT 1",
        [existing.id],
      );
      if (!String(updated[0]?.role ?? "").split(",").includes("admin")) {
        throw new Error("Role update did not take effect.");
      }
      console.info(`✓ ${email} is now a platform administrator.`);
    } else {
      // No account yet — create one with admin role.
      console.info(`No account found for ${email}. Creating platform administrator…`);
      const result = await auth.api.createUser({
        body: { email, name, password, role: "admin" },
      });
      if (!result.user.role?.split(",").includes("admin")) {
        throw new Error("The account was created without platform-admin privileges.");
      }
      console.info(`✓ Created platform administrator: ${result.user.email}`);
    }
  } finally {
    try { await connection.query("SELECT 1"); } catch { /* ignore */ }
    await connection.end();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unexpected failure.";
  console.error(`ensure-platform-admin failed: ${message}`);
  process.exitCode = 1;
});
