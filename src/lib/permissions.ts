import "server-only";
import { and, eq, inArray, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { cache } from "react";
import { db } from "@/db";
import { orgMemberships, rolePermissions, schoolMemberships, schools } from "@/db/schema";
import { UserError } from "@/lib/action-result";
import { auth } from "@/lib/auth";
import { ancestors, loadHierarchy, schoolAncestors, schoolIdsUnder, type Hierarchy } from "@/lib/hierarchy";
import { allows, DEFAULT_PRIVILEGES, type PrivilegeAction, type PrivilegeResource } from "@/lib/privileges";
import { ORG_ROLE_AT_SCHOOL, type OrgRoleName, type SchoolRoleName } from "@/lib/roles";

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

/** The hierarchy units the user administers or supervises. */
export const getOrgRoles = cache(async (userId: string) => db
  .select({ unitId: orgMemberships.orgUnitId, role: orgMemberships.role })
  .from(orgMemberships)
  .where(eq(orgMemberships.userId, userId)));

/**
 * School roles that come from a hierarchy role: an administrator of a woreda acts as the school
 * administrator of every school in that woreda's clusters, a cluster supervisor as their supervisor.
 */
export const getDerivedSchoolRoles = cache(async (userId: string) => {
  const orgRoles = await getOrgRoles(userId);
  if (orgRoles.length === 0) return [];
  const hierarchy = await loadHierarchy();
  return orgRoles.flatMap(({ unitId, role }) => schoolIdsUnder(hierarchy, unitId)
    .map((schoolId) => ({ schoolId, role: ORG_ROLE_AT_SCHOOL[role as OrgRoleName] as SchoolRole, viaUnitId: unitId })));
});

/** Every school role the user holds at one school: direct memberships first, then hierarchy roles. */
async function schoolRolesFor(userId: string, schoolId: string) {
  const [direct, derived] = await Promise.all([
    db.select({ role: schoolMemberships.role }).from(schoolMemberships)
      .where(and(eq(schoolMemberships.schoolId, schoolId), eq(schoolMemberships.userId, userId))),
    getDerivedSchoolRoles(userId),
  ]);
  return [...new Set([
    ...direct.map(({ role }) => role),
    ...derived.filter((entry) => entry.schoolId === schoolId).map(({ role }) => role),
  ])];
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
  if (isPlatformAdmin(session)) return { session, school, role: "platform_admin" as const, roles: [] as SchoolRole[] };

  const roles = await schoolRolesFor(session.user.id, schoolId);
  if (roles.length === 0) throw new UserError("You do not have access to this school.");
  const role = allowedRoles ? roles.find((candidate) => allowedRoles.includes(candidate)) : roles[0];
  if (!role) throw new UserError("You do not have permission to perform this action.");

  return { session, school, role, roles };
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

  const derived = await getDerivedSchoolRoles(session.user.id);
  const [direct, viaHierarchy] = await Promise.all([
    db
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
      )),
    derived.length === 0
      ? Promise.resolve([])
      : db
        .select({ id: schools.id, name: schools.name, country: schools.country })
        .from(schools)
        .where(and(inArray(schools.id, [...new Set(derived.map(({ schoolId }) => schoolId))]), ne(schools.status, "suspended"))),
  ]);
  const seen = new Set<string>();
  return [...direct, ...viaHierarchy].filter((school) => !seen.has(school.id) && Boolean(seen.add(school.id)));
}

// ───────────────────────────── Privileges ─────────────────────────────

export type PrivilegeResolver = {
  hierarchy: Hierarchy;
  /** The actions `role` has on `resource` at a school, after every override above it. */
  atSchool: (schoolId: string, role: SchoolRoleName, resource: PrivilegeResource) => string[];
  /** The actions `role` has on `resource` within a hierarchy unit (its own and its ancestors' overrides). */
  atUnit: (unitId: string | null, role: SchoolRoleName, resource: PrivilegeResource) => string[];
  /** Where the value at a scope comes from: "school:…", "org_unit:…", "platform:" or "default". */
  source: (scope: PrivilegeScope, role: SchoolRoleName, resource: PrivilegeResource) => string;
  /** The actions in effect at a scope (the platform scope resolves to its override or the default). */
  atScope: (scope: PrivilegeScope, role: SchoolRoleName, resource: PrivilegeResource) => string[];
};

export type PrivilegeScope = { type: "platform"; id: "" } | { type: "org_unit"; id: string } | { type: "school"; id: string };

// Overrides are few (roles × resources × configured scopes), so they are read once per request.
export const getPrivilegeResolver = cache(async (): Promise<PrivilegeResolver> => {
  const [hierarchy, overrides] = await Promise.all([
    loadHierarchy(),
    db.select({
      scopeType: rolePermissions.scopeType,
      scopeId: rolePermissions.scopeId,
      role: rolePermissions.role,
      resource: rolePermissions.resource,
      actions: rolePermissions.actions,
    }).from(rolePermissions),
  ]);
  const table = new Map(overrides.map((row) => [`${row.scopeType}:${row.scopeId}:${row.role}:${row.resource}`, row.actions]));

  function chain(scope: PrivilegeScope) {
    if (scope.type === "platform") return ["platform:"];
    const units = scope.type === "school" ? schoolAncestors(hierarchy, scope.id) : ancestors(hierarchy, scope.id);
    return [
      ...(scope.type === "school" ? [`school:${scope.id}`] : []),
      ...units.map((unit) => `org_unit:${unit.id}`),
      "platform:",
    ];
  }
  function resolve(scope: PrivilegeScope, role: SchoolRoleName, resource: PrivilegeResource) {
    for (const link of chain(scope)) {
      const actions = table.get(`${link}:${role}:${resource}`);
      if (actions) return { actions, scope: link };
    }
    return { actions: DEFAULT_PRIVILEGES[role]?.[resource] ?? [], scope: "default" };
  }

  return {
    hierarchy,
    atSchool: (schoolId, role, resource) => resolve({ type: "school", id: schoolId }, role, resource).actions,
    atUnit: (unitId, role, resource) => resolve(unitId ? { type: "org_unit", id: unitId } : { type: "platform", id: "" }, role, resource).actions,
    source: (scope, role, resource) => resolve(scope, role, resource).scope,
    atScope: (scope, role, resource) => resolve(scope, role, resource).actions,
  };
});

/** Whether any of `roles` may take `action` on `resource` at the school. */
export async function rolesAllow(schoolId: string, roles: readonly SchoolRole[], resource: PrivilegeResource, action: PrivilegeAction) {
  const resolver = await getPrivilegeResolver();
  return roles.some((role) => allows(resolver.atSchool(schoolId, role, resource), action));
}

/**
 * Checks the signed-in user's privilege for one action at one school and returns their access.
 * Platform (super) administrators may do everything.
 */
export async function requirePrivilege(schoolId: string, resource: PrivilegeResource, action: PrivilegeAction) {
  const access = await requireSchoolRole(schoolId);
  if (access.role === "platform_admin") return access;
  if (!(await rolesAllow(schoolId, access.roles, resource, action))) {
    throw new UserError("Your role does not have the privilege for this action. Ask an administrator to grant it.");
  }
  return access;
}

/** Whether the user administers this hierarchy unit: they are an administrator of it or of a unit above it. */
export async function canAdministerUnit(unitId: string | null) {
  const session = await requireSession();
  if (isPlatformAdmin(session)) return true;
  if (!unitId) return false;
  const [orgRoles, hierarchy] = await Promise.all([getOrgRoles(session.user.id), loadHierarchy()]);
  const above = new Set(ancestors(hierarchy, unitId).map((unit) => unit.id));
  return orgRoles.some(({ unitId: held, role }) => role === "org_admin" && above.has(held));
}

export async function requireUnitAdmin(unitId: string | null) {
  if (!(await canAdministerUnit(unitId))) {
    throw new UserError(unitId
      ? "Only an administrator of this unit (or a unit above it) can do this."
      : "Only the super administrator can change the top of the hierarchy.");
  }
  return requireSession();
}
