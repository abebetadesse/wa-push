import "server-only";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { authAccounts, authUsers } from "@/db/schema";

/** The marker the portal's approval queue looks for (see gateway/approvals.js). */
export const PENDING_APPROVAL = "pending_approval";

/** Marks a student account that waits for its school's approval, not the portal's queue. */
export const PENDING_SCHOOL_APPLICATION = "pending_school_application";

export function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function validEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export async function findUserByEmail(email: string) {
  const [user] = await db
    .select({ id: authUsers.id, name: authUsers.name, email: authUsers.email, banned: authUsers.banned })
    .from(authUsers)
    .where(eq(authUsers.email, email))
    .limit(1);
  return user ?? null;
}

/**
 * Creates an email-and-password account the way the sign-up endpoint would, without signing anyone in.
 * `pending` leaves it switched off until the portal's approval queue approves it.
 */
export async function createCredentialAccount(input: { name: string; email: string; password: string; pending?: boolean }) {
  const id = randomUUID();
  const passwordHash = await hashPassword(input.password);
  await db.transaction(async (tx) => {
    await tx.insert(authUsers).values({
      id,
      name: input.name,
      email: input.email,
      emailVerified: true,
      role: "user",
      ...(input.pending ? { banned: true, banReason: PENDING_APPROVAL } : {}),
    });
    await tx.insert(authAccounts).values({ id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: passwordHash });
  });
  return id;
}
