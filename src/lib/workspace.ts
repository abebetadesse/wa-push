import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { schoolMemberships } from "@/db/schema";
import { getAccessibleSchools, getSession, isPlatformAdmin, type SchoolRole } from "@/lib/permissions";
import type { WorkspaceAccess } from "@/lib/navigation";
import { STAFF_ROLES } from "@/lib/roles";

export type WorkspaceContext = {
  userId: string;
  userName: string;
  userEmail: string;
  platformAdmin: boolean;
  roles: { schoolId: string; role: SchoolRole }[];
  schools: { id: string; name: string; country: string | null }[];
  access: WorkspaceAccess;
};

// Who may open each group of workspace pages. The pages and the sidebar (through getAccess) both
// read these lists, so a link is shown exactly when its page lets the user in.
export const pageRoles = {
  dashboard: STAFF_ROLES,
  academics: ["school_admin", "teacher"],
  schoolAdmin: ["school_admin"],
  inventory: ["school_admin", "inventory_manager"],
  hr: ["school_admin", "hr_manager"],
  library: ["school_admin", "librarian"],
  lab: ["school_admin", "lab_technician"],
  workshop: ["school_admin", "workshop_manager"],
  community: ["school_admin", "community_officer"],
  pr: ["school_admin", "pr_officer"],
} as const satisfies Record<string, readonly SchoolRole[]>;

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

export async function requireWorkspaceContext() {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login");
  return context;
}

/** Whether the user holds one of `roles` at this school. Platform admins hold every role everywhere. */
export function hasSchoolRole(context: WorkspaceContext, schoolId: string, roles: readonly SchoolRole[]) {
  return context.platformAdmin || context.roles.some((membership) => membership.schoolId === schoolId && roles.includes(membership.role));
}

/**
 * The active schools where the user holds one of `roles` (every active school for platform admins).
 * Redirects to /login without a session and to /no-access when there are none.
 */
export async function requireSchoolsFor(roles: readonly SchoolRole[]) {
  const context = await requireWorkspaceContext();
  const schoolIds = context.platformAdmin
    ? context.schools.map((school) => school.id)
    : context.roles.filter(({ role }) => roles.includes(role)).map(({ schoolId }) => schoolId);
  if (schoolIds.length === 0) redirect("/no-access");

  return {
    context,
    schoolIds,
    schools: context.schools.filter((school) => schoolIds.includes(school.id)),
    hasRole: (schoolId: string, ...wanted: SchoolRole[]) => hasSchoolRole(context, schoolId, wanted),
  };
}

function getAccess(platformAdmin: boolean, roles: SchoolRole[]): WorkspaceAccess {
  const has = (wanted: readonly SchoolRole[]) => platformAdmin || roles.some((role) => wanted.includes(role));
  return {
    platformAdmin,
    dashboard: has(pageRoles.dashboard),
    academics: has(pageRoles.academics),
    schoolAdmin: has(pageRoles.schoolAdmin),
    inventory: has(pageRoles.inventory),
    hr: has(pageRoles.hr),
    library: has(pageRoles.library),
    lab: has(pageRoles.lab),
    workshop: has(pageRoles.workshop),
    community: has(pageRoles.community),
    pr: has(pageRoles.pr),
    student: roles.includes("student"),
  };
}

// Where a signed-in member should land: the staff dashboard, or the student portal.
export function getHomePath(access: WorkspaceAccess) {
  if (access.dashboard) return "/";
  if (access.student) return "/my-learning";
  return null;
}
