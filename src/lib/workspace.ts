import "server-only";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { schoolMemberships } from "@/db/schema";
import { getAccessibleSchools, getSession, isPlatformAdmin, type SchoolRole } from "@/lib/permissions";
import type { WorkspaceAccess } from "@/lib/navigation";

export type WorkspaceContext = {
  userId: string;
  userName: string;
  userEmail: string;
  platformAdmin: boolean;
  roles: { schoolId: string; role: SchoolRole }[];
  schools: { id: string; name: string; country: string | null }[];
  access: WorkspaceAccess;
};

// One lookup per request, shared by the workspace layout and the page it renders.
export const getWorkspaceContext = cache(async (): Promise<WorkspaceContext | null> => {
  const session = await getSession();
  if (!session) return null;

  const platformAdmin = isPlatformAdmin(session);
  const [schools, roles] = await Promise.all([
    getAccessibleSchools(),
    platformAdmin
      ? Promise.resolve([])
      : db
        .select({ schoolId: schoolMemberships.schoolId, role: schoolMemberships.role })
        .from(schoolMemberships)
        .where(eq(schoolMemberships.userId, session.user.id)),
  ]);
  const activeSchoolIds = new Set(schools.map((school) => school.id));
  const activeRoles = roles.filter(({ schoolId }) => activeSchoolIds.has(schoolId));

  return {
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
    platformAdmin,
    roles: activeRoles,
    schools,
    access: getAccess(platformAdmin, activeRoles.map(({ role }) => role)),
  };
});

function getAccess(platformAdmin: boolean, roles: SchoolRole[]): WorkspaceAccess {
  const has = (...wanted: SchoolRole[]) => platformAdmin || roles.some((role) => wanted.includes(role));
  return {
    platformAdmin,
    dashboard: has("school_admin", "teacher", "inventory_manager", "hr_manager"),
    academics: has("school_admin", "teacher"),
    schoolAdmin: has("school_admin"),
    inventory: has("school_admin", "inventory_manager"),
    hr: has("school_admin", "hr_manager"),
    student: roles.includes("student"),
  };
}

// Where a signed-in member should land: the staff dashboard, or the student portal.
export function getHomePath(access: WorkspaceAccess) {
  if (access.dashboard) return "/";
  if (access.student) return "/my-learning";
  return null;
}
