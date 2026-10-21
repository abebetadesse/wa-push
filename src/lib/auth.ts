import "server-only";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { db } from "@/db";
import { authBasePath } from "@/lib/base-path";
import { sendEmail } from "@/lib/email";
import { acceptInvitation, findPendingInvitation } from "@/lib/invitations";
import {
  authAccounts,
  authSessions,
  authUsers,
  authVerifications,
} from "@/db/schema";

const authSecret = process.env.BETTER_AUTH_SECRET;
const authBaseUrl = process.env.BETTER_AUTH_URL;

if (!authSecret || authSecret.length < 32) {
  throw new Error("BETTER_AUTH_SECRET must be configured with at least 32 characters.");
}
if (!authBaseUrl) {
  throw new Error("BETTER_AUTH_URL must be configured with the public application URL.");
}
const authUrl = new URL(authBaseUrl);
const isLoopbackHost = ["localhost", "127.0.0.1", "[::1]"].includes(authUrl.hostname);
if (process.env.NODE_ENV === "production" && authUrl.protocol !== "https:" && !isLoopbackHost) {
  throw new Error("BETTER_AUTH_URL must use HTTPS in production.");
}

export const auth = betterAuth({
  appName: "Forma",
  baseURL: authUrl.origin,
  basePath: authBasePath,
  trustedOrigins: [authUrl.origin],
  secret: authSecret,
  // Forma shares www.wisdomcourse.com.et with other apps (see docs/SINGLE-DOMAIN.md). Cookies are per
  // domain, not per path, so a distinct prefix keeps another better-auth app's session cookie from
  // replacing Forma's. Changing it signs everyone out once.
  advanced: { cookiePrefix: "forma" },
  database: drizzleAdapter(db, {
    provider: "mysql",
    schema: {
      user: authUsers,
      session: authSessions,
      account: authAccounts,
      verification: authVerifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: false,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    requireEmailVerification: false,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your Forma password",
        text: `Use this secure link to reset your password: ${url}\n\nIf you did not request this, you can ignore this email.`,
      });
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 3 },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (context) => {
      if (context.path !== "/sign-up/email") return;

      const token = context.headers?.get("x-school-invitation-token");
      const email = context.body?.email;
      if (typeof token !== "string" || typeof email !== "string") {
        throw new APIError("FORBIDDEN", {
          message: "An active school invitation is required to create an account.",
        });
      }

      const invitation = await findPendingInvitation(token, email);
      if (!invitation) {
        throw new APIError("FORBIDDEN", {
          message: "This invitation is invalid, expired, or already used.",
        });
      }
    }),
    after: createAuthMiddleware(async (context) => {
      if (context.path !== "/sign-up/email") return;
      const token = context.headers?.get("x-school-invitation-token");
      const session = context.context.newSession;
      if (!token || !session) return;

      await acceptInvitation(token, session.user.email, session.user.id);
    }),
  },
  plugins: [admin({ defaultRole: "user", adminRoles: ["admin"] }), nextCookies()],
});
