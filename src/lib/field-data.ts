import "server-only";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { fieldDefinitions, fieldValues, type FieldValue } from "@/db/schema";
import type { FieldEntity } from "@/lib/custom-fields";
import { ancestors, loadHierarchy, schoolAncestors } from "@/lib/hierarchy";
import { allows } from "@/lib/privileges";
import type { PrivilegeResolver, SchoolRole } from "@/lib/permissions";

export type FieldDefinition = typeof fieldDefinitions.$inferSelect;

/** Where a definition applies: "Platform", a unit name, or "This school". */
export type DefinitionScope = { type: "platform" | "org_unit" | "school"; id: string };

/** Definitions that apply at a school: platform-wide, from any unit above it, and its own. */
export async function fieldsForSchool(schoolId: string, entity: FieldEntity, { includeInactive = false } = {}) {
  const hierarchy = await loadHierarchy();
  const unitIds = schoolAncestors(hierarchy, schoolId).map((unit) => unit.id);
  return db.select().from(fieldDefinitions).where(and(
    eq(fieldDefinitions.entity, entity),
    includeInactive ? undefined : eq(fieldDefinitions.isActive, true),
    or(
      eq(fieldDefinitions.scopeType, "platform"),
      unitIds.length ? and(eq(fieldDefinitions.scopeType, "org_unit"), inArray(fieldDefinitions.scopeId, unitIds)) : undefined,
      and(eq(fieldDefinitions.scopeType, "school"), eq(fieldDefinitions.scopeId, schoolId)),
    ),
  )).orderBy(asc(fieldDefinitions.section), asc(fieldDefinitions.sortOrder), asc(fieldDefinitions.label));
}

/** Definitions that apply anywhere at or above a hierarchy unit (for unit-level reports and templates). */
export async function fieldsForUnit(unitId: string | null, entity: FieldEntity) {
  const hierarchy = await loadHierarchy();
  const unitIds = ancestors(hierarchy, unitId).map((unit) => unit.id);
  return db.select().from(fieldDefinitions).where(and(
    eq(fieldDefinitions.entity, entity),
    eq(fieldDefinitions.isActive, true),
    or(
      eq(fieldDefinitions.scopeType, "platform"),
      unitIds.length ? and(eq(fieldDefinitions.scopeType, "org_unit"), inArray(fieldDefinitions.scopeId, unitIds)) : undefined,
    ),
  )).orderBy(asc(fieldDefinitions.section), asc(fieldDefinitions.sortOrder), asc(fieldDefinitions.label));
}

/**
 * Whether someone with `roles` at the school may change this field's values: their roles must hold
 * the field-data privilege, and the field must allow one of their roles (or allow all).
 */
export function mayEditField(field: FieldDefinition, roles: readonly SchoolRole[], resolver: PrivilegeResolver, schoolId: string, platformAdmin: boolean) {
  if (platformAdmin) return field.fieldType !== "formula";
  if (field.fieldType === "formula") return false;
  return roles.some((role) => allows(resolver.atSchool(schoolId, role, "field_data"), "edit")
    && (!field.editRoles?.length || field.editRoles.includes(role) || role === "school_admin"));
}

export function mayViewField(field: FieldDefinition, roles: readonly SchoolRole[], resolver: PrivilegeResolver, schoolId: string, platformAdmin: boolean) {
  if (platformAdmin) return true;
  return roles.some((role) => allows(resolver.atSchool(schoolId, role, "field_data"), "read")
    && (!field.viewRoles?.length || field.viewRoles.includes(role) || role === "school_admin"));
}

/** Stored values for the given records as Map<entityId, Map<fieldKey, value>>. */
export async function loadFieldValues(fields: FieldDefinition[], entityIds: string[], period: string) {
  const result = new Map<string, Map<string, FieldValue>>();
  if (fields.length === 0 || entityIds.length === 0) return result;
  const keyById = new Map(fields.map((field) => [field.id, field]));
  const rows: { fieldId: string; entityId: string; period: string; value: FieldValue }[] = [];
  for (let start = 0; start < entityIds.length; start += 1000) {
    rows.push(...await db.select({ fieldId: fieldValues.fieldId, entityId: fieldValues.entityId, period: fieldValues.period, value: fieldValues.value })
      .from(fieldValues)
      .where(and(inArray(fieldValues.fieldId, [...keyById.keys()]), inArray(fieldValues.entityId, entityIds.slice(start, start + 1000)))));
  }
  for (const row of rows) {
    const field = keyById.get(row.fieldId)!;
    // Periodic fields read the chosen period; others are kept once, under "".
    if (row.period !== (field.isPeriodic ? period : "")) continue;
    const values = result.get(row.entityId) ?? new Map<string, FieldValue>();
    values.set(field.fieldKey, row.value);
    result.set(row.entityId, values);
  }
  return result;
}

/** The periods that have stored values, newest first. */
export async function knownPeriods(schoolIds: string[]) {
  if (schoolIds.length === 0) return [];
  const rows = await db.selectDistinct({ period: fieldValues.period }).from(fieldValues)
    .where(inArray(fieldValues.schoolId, schoolIds));
  return rows.map((row) => row.period).filter(Boolean).sort().reverse();
}

/** The default period label: the current Ethiopian calendar year, e.g. "2019 E.C.". */
export function currentEthiopianYear(now = new Date()) {
  // The Ethiopian year starts on Meskerem 1 (11 September, or 12 September before a Gregorian leap year).
  const year = now.getUTCFullYear();
  const newYear = Date.UTC(year, 8, (year + 1) % 4 === 0 ? 12 : 11);
  return `${now.getTime() >= newYear ? year - 7 : year - 8} E.C.`;
}
