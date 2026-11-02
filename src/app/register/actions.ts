"use server";

import { headers } from "next/headers";
import { guardAction, type ActionState } from "@/lib/action-result";
import { createCredentialAccount, findUserByEmail, normalizeEmail, validEmail } from "@/lib/accounts";
import { selfRegistrationOpen } from "@/lib/portal-policy";

// Five registrations an hour from one address is plenty for a person and slow for a script.
const recent = new Map<string, number[]>();

async function registerAccountImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  if (!selfRegistrationOpen()) return { error: "Registration is closed. Ask a school administrator to add you." };

  const name = String(formData.get("name") ?? "").trim();
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  if (name.length < 2 || name.length > 255) return { error: "Enter your full name." };
  if (!validEmail(email)) return { error: "Enter your full email address, for example name@gmail.com." };
  if (password.length < 12 || password.length > 128) return { error: "Choose a password of at least 12 characters." };

  const forwarded = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const hits = (recent.get(forwarded) ?? []).filter((time) => now - time < 3_600_000);
  if (hits.length >= 5) return { error: "Too many registrations from this address. Try again later." };
  recent.set(forwarded, [...hits, now]);

  if (await findUserByEmail(email)) {
    // The same answer as a success, so the form cannot be used to find out who has an account.
    return { success: "Thank you. Your registration is waiting for approval. You can sign in once an administrator approves it." };
  }
  await createCredentialAccount({ name, email, password, pending: true });
  return { success: "Thank you. Your registration is waiting for approval. You can sign in once an administrator approves it." };
}

export async function registerAccount(...args: Parameters<typeof registerAccountImpl>) {
  return guardAction(() => registerAccountImpl(...args));
}
