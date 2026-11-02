"use server";

import { guardAction } from "@/lib/action-result";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { activityEvents, orgUnits, schoolMemberships, schools } from "@/db/schema";
import { UserError } from "@/lib/action-result";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/permissions";
import { chooseSlug } from "@/lib/slug";

export type CreateSchoolState = {
  error?: string;
};

async function createSchoolImpl(
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
  // The public page is /<slug>: the name's own slug when free, so it reads like the school's name.
  let slug: string;
  try {
    slug = await chooseSlug(name, String(formData.get("slug") ?? "").trim().toLowerCase() || null);
  } catch (error) {
    if (error instanceof UserError) return { error: error.message };
    throw error;
  }
  const clusterId = String(formData.get("clusterId") ?? "").trim() || null;
  if (clusterId) {
    const [cluster] = await db.select({ level: orgUnits.level }).from(orgUnits).where(eq(orgUnits.id, clusterId)).limit(1);
    if (cluster?.level !== "cluster") return { error: "Choose a school cluster." };
  }
  const schoolCode = String(formData.get("schoolCode") ?? "").trim().slice(0, 40) || null;
  const kebele = String(formData.get("kebele") ?? "").trim().slice(0, 120) || null;

  try {
    await db.transaction(async (tx) => {
      await tx.insert(schools).values({
        id: schoolId,
        name,
        slug,
        country: country || null,
        orgUnitId: clusterId,
        schoolCode,
        kebele,
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
  } catch (error) {
    // Previously this surfaced only as a bare 500. Tell the platform admin what the database said.
    const cause = (error as { cause?: { code?: string; sqlMessage?: string } })?.cause ?? (error as { code?: string; sqlMessage?: string });
    console.error("[forma] creating a school failed:", error);
    return {
      error: `The school could not be saved${cause?.code ? ` (${cause.code}${cause.sqlMessage ? `: ${cause.sqlMessage}` : ""})` : ""}. Open /api/health for details.`,
    };
  }

  redirect("/");
}

// Every action runs through guardAction, so a failure reaches the form as a message instead of
// a blank HTTP 500 (Next.js hides thrown messages in production).
export async function createSchool(...args: Parameters<typeof createSchoolImpl>) {
  return guardAction(() => createSchoolImpl(...args));
}
