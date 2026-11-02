"use server";

import { guardAction, UserError, type ActionState } from "@/lib/action-result";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { rolePermissions } from "@/db/schema";
import { loadHierarchy } from "@/lib/hierarchy";
import {
  canAdministerUnit,
  getPrivilegeResolver,
  isPlatformAdmin,
  requirePrivilege,
  requireSession,
  type PrivilegeScope,
} from "@/lib/permissions";
import { allows, DEFAULT_PRIVILEGES, PRIVILEGE_ACTIONS, RESOURCE_KEYS, type PrivilegeAction } from "@/lib/privileges";
import { SCHOOL_ROLES, type SchoolRoleName } from "@/lib/roles";

function readScope(formData: FormData): PrivilegeScope {
  const type = String(formData.get("scopeType") ?? "");
  const id = String(formData.get("scopeId") ?? "");
  if (type === "platform") return { type, id: "" };
  if ((type === "org_unit" || type === "school") && /^[0-9a-f-]{36}$/i.test(id)) return { type, id };
  throw new UserError("Choose where the privileges apply.");
}

/**
 * Who may change privileges at a scope, and what they may grant. Super administrators and the
 * administrators of a unit above may set anything; a school's own administrator may set every role
 * except school administrator, and only grant actions they hold themselves.
 */
async function editorFor(scope: PrivilegeScope, role: SchoolRoleName) {
  const session = await requireSession();
  if (isPlatformAdmin(session)) return { session, limit: null as null | ((resource: string, action: PrivilegeAction) => boolean) };
  if (scope.type === "platform") throw new UserError("Only the super administrator can change the platform defaults.");
  if (scope.type === "org_unit") {
    if (!(await canAdministerUnit(scope.id))) throw new UserError("Only an administrator of this unit or one above it can change its privileges.");
    return { session, limit: null };
  }
  const hierarchy = await loadHierarchy();
  if (await canAdministerUnit(hierarchy.schoolUnit.get(scope.id) ?? null)) return { session, limit: null };
  const access = await requirePrivilege(scope.id, "privileges", "edit");
  if (role === "school_admin") throw new UserError("A school administrator's privileges are set by the cluster, woreda or super administrator.");
  const resolver = await getPrivilegeResolver();
  return {
    session,
    limit: (resource: string, action: PrivilegeAction) => access.roles.some((held) => allows(resolver.atSchool(scope.id, held, resource as never), action)),
  };
}

/** What a scope would have without its own override: its parent's value. */
async function inherited(scope: PrivilegeScope, role: SchoolRoleName, resource: (typeof RESOURCE_KEYS)[number]) {
  if (scope.type === "platform") return DEFAULT_PRIVILEGES[role]?.[resource] ?? [];
  const resolver = await getPrivilegeResolver();
  if (scope.type === "school") return resolver.atUnit(resolver.hierarchy.schoolUnit.get(scope.id) ?? null, role, resource);
  return resolver.atUnit(resolver.hierarchy.byId.get(scope.id)?.parentId ?? null, role, resource);
}

function sameActions(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((action) => b.includes(action));
}

function revalidate() {
  revalidatePath("/privileges");
  revalidatePath("/", "layout");
}

async function savePrivilegesImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const scope = readScope(formData);
  const role = String(formData.get("role") ?? "") as SchoolRoleName;
  if (!SCHOOL_ROLES.includes(role)) throw new UserError("Choose a role.");
  const { session, limit } = await editorFor(scope, role);
  const resolver = await getPrivilegeResolver();
  let changed = 0;

  for (const resource of RESOURCE_KEYS) {
    const chosen = PRIVILEGE_ACTIONS.filter((action) => formData.get(`${resource}:${action}`) === "on");
    const actions: string[] = chosen.includes("manage") ? ["manage"] : chosen;
    const current = resolver.atScope(scope, role, resource);
    if (limit) {
      const granted = actions.filter((action) => !allows(current, action as PrivilegeAction));
      const refused = granted.find((action) => !limit(resource, action as PrivilegeAction));
      if (refused) throw new UserError(`You cannot grant “${refused}” on ${resource.replaceAll("_", " ")}: your own role does not have it.`);
    }
    const parentActions = await inherited(scope, role, resource);
    const where = and(
      eq(rolePermissions.scopeType, scope.type),
      eq(rolePermissions.scopeId, scope.id),
      eq(rolePermissions.role, role),
      eq(rolePermissions.resource, resource),
    );
    if (sameActions(actions, parentActions)) {
      // Back to what it inherits: drop the override so later changes above flow through.
      const result = await db.delete(rolePermissions).where(where);
      if ((result[0] as { affectedRows?: number }).affectedRows) changed += 1;
      continue;
    }
    if (sameActions(actions, current) && resolver.source(scope, role, resource) === (scope.type === "platform" ? "platform:" : `${scope.type}:${scope.id}`)) continue;
    await db.insert(rolePermissions)
      .values({ scopeType: scope.type, scopeId: scope.id, role, resource, actions, updatedBy: session.user.id })
      .onDuplicateKeyUpdate({ set: { actions, updatedBy: session.user.id } });
    changed += 1;
  }
  revalidate();
  return { success: changed ? `Saved ${changed} change${changed === 1 ? "" : "s"}.` : "Nothing changed." };
}

async function resetPrivilegesImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const scope = readScope(formData);
  const role = String(formData.get("role") ?? "") as SchoolRoleName;
  if (!SCHOOL_ROLES.includes(role)) throw new UserError("Choose a role.");
  await editorFor(scope, role);
  await db.delete(rolePermissions).where(and(
    eq(rolePermissions.scopeType, scope.type),
    eq(rolePermissions.scopeId, scope.id),
    eq(rolePermissions.role, role),
  ));
  revalidate();
  return { success: "This role now inherits every privilege from above." };
}

export async function savePrivileges(...args: Parameters<typeof savePrivilegesImpl>) { return guardAction(() => savePrivilegesImpl(...args)); }
export async function resetPrivileges(...args: Parameters<typeof resetPrivilegesImpl>) { return guardAction(() => resetPrivilegesImpl(...args)); }
