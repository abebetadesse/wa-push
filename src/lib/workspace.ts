import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { schoolMemberships } from "@/db/schema";
import {
  getAccessibleSchools,
  getDerivedSchoolRoles,
  getOrgRoles,
  getPrivilegeResolver,
  getSession,
  isPlatformAdmin,
  type PrivilegeResolver,
  type SchoolRole,
} from "@/lib/permissions";
import type { WorkspaceAccess } from "@/lib/navigation";
import { allows, type PrivilegeAction, type PrivilegeResource } from "@/lib/privileges";
import type { OrgRoleName } from "@/lib/roles";
import { STAFF_ROLES } from "@/lib/roles";

export type WorkspaceContext = {
  userId: string;
  userName: string;
  userEmail: string;
  platformAdmin: boolean;
  /** School roles: direct memberships plus those that come from hierarchy roles. */
  roles: { schoolId: string; role: SchoolRole }[];
  /** Hierarchy units the user administers or supervises. */
  orgRoles: { unitId: string; role: OrgRoleName }[];
  schools: { id: string; name: string; country: string | null }[];
  access: WorkspaceAccess;
};

// Who may open each group of workspace pages. The pages and the sidebar (through getAccess) both
// read these lists, so a link is shown exactly when its page lets the user in.
export const pageRoles = {
  dashboard: STAFF_ROLES,
  academics: ["school_admin", "supervisor", "teacher"],
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
  const [schools, direct, derived, orgRoles, resolver] = await Promise.all([
    getAccessibleSchools(),
    platformAdmin
      ? Promise.resolve([])
      : db
        .select({ schoolId: schoolMemberships.schoolId, role: schoolMemberships.role })
        .from(schoolMemberships)
        .where(eq(schoolMemberships.userId, session.user.id)),
    platformAdmin ? Promise.resolve([]) : getDerivedSchoolRoles(session.user.id),
    platformAdmin ? Promise.resolve([]) : getOrgRoles(session.user.id),
    getPrivilegeResolver(),
  ]);
  const activeSchoolIds = new Set(schools.map((school) => school.id));
  const seen = new Set<string>();
  const activeRoles = [...direct, ...derived.map(({ schoolId, role }) => ({ schoolId, role }))]
    .filter(({ schoolId, role }) => activeSchoolIds.has(schoolId) && !seen.has(`${schoolId}:${role}`) && Boolean(seen.add(`${schoolId}:${role}`)));

  return {
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
    platformAdmin,
    roles: activeRoles,
    orgRoles: orgRoles.map(({ unitId, role }) => ({ unitId, role: role as OrgRoleName })),
    schools,
    access: getAccess(platformAdmin, activeRoles, orgRoles.length > 0, resolver),
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
    : [...new Set(context.roles.filter(({ role }) => roles.includes(role)).map(({ schoolId }) => schoolId))];
  if (schoolIds.length === 0) redirect("/no-access");

  return {
    context,
    schoolIds,
    schools: context.schools.filter((school) => schoolIds.includes(school.id)),
    hasRole: (schoolId: string, ...wanted: SchoolRole[]) => hasSchoolRole(context, schoolId, wanted),
  };
}

/**
 * The active schools where the user's roles grant `action` on `resource`, and a checker for other
 * actions there. Redirects to /no-access when there are none.
 */
export async function requireSchoolsWithPrivilege(resource: PrivilegeResource, action: PrivilegeAction = "read") {
  const context = await requireWorkspaceContext();
  const resolver = await getPrivilegeResolver();
  const can = (schoolId: string, wantedResource: PrivilegeResource, wanted: PrivilegeAction) => context.platformAdmin
    || context.roles.some((membership) => membership.schoolId === schoolId && allows(resolver.atSchool(schoolId, membership.role, wantedResource), wanted));
  const schoolIds = context.schools.map((school) => school.id).filter((schoolId) => can(schoolId, resource, action));
  if (schoolIds.length === 0) redirect("/no-access");
  return {
    context,
    resolver,
    schoolIds,
    schools: context.schools.filter((school) => schoolIds.includes(school.id)),
    can,
    rolesAt: (schoolId: string) => context.roles.filter((membership) => membership.schoolId === schoolId).map(({ role }) => role),
  };
}

function getAccess(platformAdmin: boolean, memberships: { schoolId: string; role: SchoolRole }[], hasOrgRole: boolean, resolver: PrivilegeResolver): WorkspaceAccess {
  const roles = memberships.map(({ role }) => role);
  const has = (wanted: readonly SchoolRole[]) => platformAdmin || roles.some((role) => wanted.includes(role));
  const grants = (resource: PrivilegeResource, action: PrivilegeAction = "read", among = memberships) => platformAdmin
    || among.some(({ schoolId, role }) => allows(resolver.atSchool(schoolId, role, resource), action));
  // Students and guardians see their own certificates in their portal, not the certificate office.
  const staffMemberships = memberships.filter(({ role }) => role !== "student" && role !== "guardian");
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
    organization: hasOrgRole || grants("hierarchy"),
    privileges: hasOrgRole || grants("privileges"),
    analytics: grants("reports", "read", staffMemberships),
    dataFields: grants("data_fields", "read", staffMemberships) || grants("field_data", "read", staffMemberships),
    certificates: grants("certificates", "read", staffMemberships),
    discussions: grants("discussions"),
    applications: grants("applications"),
  };
}

// Where a signed-in member should land: the staff dashboard, or the student portal.
export function getHomePath(access: WorkspaceAccess) {
  if (access.dashboard) return "/";
  if (access.student) return "/my-learning";
  return null;
}
