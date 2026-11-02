"use server";

import { guardAction, type ActionState } from "@/lib/action-result";

import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { headers } from "next/headers";
import { db } from "@/db";
import { authAccounts, authUsers, studentApplications } from "@/db/schema";
import { findUserByEmail, normalizeEmail, PENDING_SCHOOL_APPLICATION, validEmail } from "@/lib/accounts";
import { isDate } from "@/lib/form-fields";
import { loadPublicSchool } from "@/lib/public-school";

const recent = new Map<string, number[]>();
const RECEIVED = "Thank you. Your application was sent to the school. You can sign in once the school approves it.";

async function applyImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const school = await loadPublicSchool(String(formData.get("slug") ?? ""));
  if (!school || !school.studentRegistrationOpen) return { error: "This school is not taking student registrations online." };

  const raw = (name: string, max: number) => String(formData.get(name) ?? "").trim().slice(0, max);
  const firstName = raw("firstName", 100);
  const lastName = raw("lastName", 100);
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const dateOfBirth = raw("dateOfBirth", 10);
  const gender = raw("gender", 10);
  if (firstName.length < 1 || lastName.length < 1) return { error: "Enter your first and last name." };
  if (!validEmail(email)) return { error: "Enter your full email address, for example name@gmail.com." };
  if (password.length < 12 || password.length > 128) return { error: "Choose a password of at least 12 characters." };
  if (dateOfBirth && !isDate(dateOfBirth)) return { error: "Enter a valid date of birth." };
  if (gender && gender !== "female" && gender !== "male") return { error: "Choose female or male." };
  if (formData.get("consent") !== "on") return { error: "Confirm that a parent or guardian agrees to this registration." };

  // Five applications an hour from one address is plenty for a family and slow for a script.
  const forwarded = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const hits = (recent.get(forwarded) ?? []).filter((time) => now - time < 3_600_000);
  if (hits.length >= 5) return { error: "Too many registrations from this address. Try again later." };
  recent.set(forwarded, [...hits, now]);

  // The same answer whether or not the email already has an account, so the form reveals nothing.
  if (await findUserByEmail(email)) return { success: `${RECEIVED} If you already have an account, ask the school to add you to it.` };

  const userId = randomUUID();
  const passwordHash = await hashPassword(password);
  await db.transaction(async (tx) => {
    await tx.insert(authUsers).values({ id: userId, name: `${firstName} ${lastName}`.slice(0, 255), email, emailVerified: false, role: "user", banned: true, banReason: PENDING_SCHOOL_APPLICATION });
    await tx.insert(authAccounts).values({ id: randomUUID(), accountId: userId, providerId: "credential", userId, password: passwordHash });
    await tx.insert(studentApplications).values({
      schoolId: school.id,
      userId,
      firstName,
      lastName,
      email,
      studentNumber: raw("studentNumber", 80) || null,
      gender: (gender || null) as "female" | "male" | null,
      dateOfBirth: dateOfBirth || null,
      gradeName: raw("gradeName", 80) || null,
      guardianPhone: raw("guardianPhone", 40) || null,
      message: raw("message", 1000) || null,
    });
  });
  return { success: RECEIVED };
}

export async function applyForStudentAccount(...args: Parameters<typeof applyImpl>) {
  return guardAction(() => applyImpl(...args));
}
