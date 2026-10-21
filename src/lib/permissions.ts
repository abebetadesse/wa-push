import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { cache } from "react";
import { db } from "@/db";
import { schoolMemberships, schools } from "@/db/schema";
import { UserError } from "@/lib/action-result";
import { auth } from "@/lib/auth";

export type SchoolRole = (typeof schoolMemberships.$inferSelect)["role"];

// Cached per request: the workspace layout, its page, and permission checks all read the session.
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new UserError("Your session has expired. Sign in again and retry.");
  return session;
}

export function isPlatformAdmin(session: Awaited<ReturnType<typeof getSession>>) {
  return session?.user.role?.split(",").includes("admin") ?? false;
}

export async function requireSchoolRole(
  schoolId: string,
  allowedRoles?: readonly SchoolRole[],
) {
  const session = await requireSession();
  const [school] = await db
    .select({
      id: schools.id,
      name: schools.name,
      status: schools.status,
    })
    .from(schools)
    .where(eq(schools.id, schoolId))
    .limit(1);

  if (!school) throw new UserError("School not found.");
  if (school.status === "suspended") throw new UserError("This school account is suspended.");
  if (isPlatformAdmin(session)) return { session, school, role: "platform_admin" as const };

  const [membership] = await db
    .select({ role: schoolMemberships.role })
    .from(schoolMemberships)
    .where(and(
      eq(schoolMemberships.schoolId, schoolId),
      eq(schoolMemberships.userId, session.user.id),
    ))
    .limit(1);

  if (!membership) throw new UserError("You do not have access to this school.");
  if (allowedRoles && !allowedRoles.includes(membership.role)) {
    throw new UserError("You do not have permission to perform this action.");
  }

  return { session, school, role: membership.role };
}

export async function getAccessibleSchools() {
  const session = await requireSession();
  if (isPlatformAdmin(session)) {
    return db
      .select({
        id: schools.id,
        name: schools.name,
        country: schools.country,
      })
      .from(schools)
      .where(ne(schools.status, "suspended"));
  }

  return db
    .select({
      id: schools.id,
      name: schools.name,
      country: schools.country,
    })
    .from(schoolMemberships)
    .innerJoin(schools, eq(schoolMemberships.schoolId, schools.id))
    .where(and(
      eq(schoolMemberships.userId, session.user.id),
      ne(schools.status, "suspended"),
    ));
}
