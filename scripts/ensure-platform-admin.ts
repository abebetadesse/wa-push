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
