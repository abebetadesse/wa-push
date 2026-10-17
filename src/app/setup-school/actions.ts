"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { activityEvents, schoolMemberships, schools } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/permissions";

export type CreateSchoolState = {
  error?: string;
};

export async function createSchool(
  _previousState: CreateSchoolState,
  formData: FormData,
): Promise<CreateSchoolState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: "Your session has expired. Sign in and try again." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();

  if (name.length < 2 || name.length > 180) {
    return { error: "School name must be between 2 and 180 characters." };
  }
  if (country.length > 100) {
    return { error: "Country must be 100 characters or fewer." };
  }

  if (!isPlatformAdmin(session)) {
    return { error: "Only a platform administrator can provision a new school." };
  }

  const schoolId = randomUUID();
  const slugBase = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 88) || "school";
  const slug = `${slugBase}-${randomUUID().slice(0, 8)}`;

  await db.transaction(async (tx) => {
    await tx.insert(schools).values({
      id: schoolId,
      name,
      slug,
      country: country || null,
    });
    await tx.insert(schoolMemberships).values({
      schoolId,
      userId: session.user.id,
      role: "school_admin",
    });
    await tx.insert(activityEvents).values({
      schoolId,
      userId: session.user.id,
      detail: `Created school ${name}`,
    });
  });

  redirect("/");
}
