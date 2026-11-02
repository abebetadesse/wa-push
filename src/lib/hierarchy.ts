import "server-only";
import { asc } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { orgUnits, schools } from "@/db/schema";
import { ORG_LEVEL_LABELS, ORG_LEVELS, type OrgLevel } from "@/lib/roles";

export type OrgUnit = { id: string; level: OrgLevel; name: string; code: string | null; parentId: string | null };

export type Hierarchy = {
  units: OrgUnit[];
  byId: Map<string, OrgUnit>;
  children: Map<string | null, OrgUnit[]>;
  /** Each school's cluster. */
  schoolUnit: Map<string, string | null>;
  schools: { id: string; name: string; slug: string; orgUnitId: string | null; status: string }[];
};

// The hierarchy is small (a few thousand units at most), so one read per request serves every lookup.
export const loadHierarchy = cache(async (): Promise<Hierarchy> => {
  const [units, schoolRows] = await Promise.all([
    db.select({ id: orgUnits.id, level: orgUnits.level, name: orgUnits.name, code: orgUnits.code, parentId: orgUnits.parentId })
      .from(orgUnits).orderBy(asc(orgUnits.name)),
    db.select({ id: schools.id, name: schools.name, slug: schools.slug, orgUnitId: schools.orgUnitId, status: schools.status })
      .from(schools).orderBy(asc(schools.name)),
  ]);
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  const children = new Map<string | null, OrgUnit[]>();
  for (const unit of units) children.set(unit.parentId, [...(children.get(unit.parentId) ?? []), unit]);
  return {
    units,
    byId,
    children,
    schoolUnit: new Map(schoolRows.map((school) => [school.id, school.orgUnitId])),
    schools: schoolRows,
  };
});

/** The unit and every unit above it, nearest first. */
export function ancestors(hierarchy: Hierarchy, unitId: string | null | undefined): OrgUnit[] {
  const chain: OrgUnit[] = [];
  const seen = new Set<string>();
  for (let unit = unitId ? hierarchy.byId.get(unitId) : undefined; unit && !seen.has(unit.id); unit = unit.parentId ? hierarchy.byId.get(unit.parentId) : undefined) {
    seen.add(unit.id);
    chain.push(unit);
  }
  return chain;
}

/** The unit and every unit below it. */
export function descendantIds(hierarchy: Hierarchy, unitId: string): Set<string> {
  const ids = new Set<string>();
  const queue = [unitId];
  while (queue.length) {
    const id = queue.pop()!;
    if (ids.has(id)) continue;
    ids.add(id);
    for (const child of hierarchy.children.get(id) ?? []) queue.push(child.id);
  }
  return ids;
}

/** The schools whose cluster lies at or below `unitId`. */
export function schoolIdsUnder(hierarchy: Hierarchy, unitId: string): string[] {
  const units = descendantIds(hierarchy, unitId);
  return hierarchy.schools.filter((school) => school.orgUnitId && units.has(school.orgUnitId)).map((school) => school.id);
}

/** The units above a school, nearest first (its cluster, woreda, zone, region). */
export function schoolAncestors(hierarchy: Hierarchy, schoolId: string) {
  return ancestors(hierarchy, hierarchy.schoolUnit.get(schoolId));
}

/** The school's place in the hierarchy as { region, zone, woreda, cluster } names. */
export function schoolPlacement(hierarchy: Hierarchy, schoolId: string): Record<OrgLevel, string> {
  const placement = Object.fromEntries(ORG_LEVELS.map((level) => [level, ""])) as Record<OrgLevel, string>;
  for (const unit of schoolAncestors(hierarchy, schoolId)) placement[unit.level] = unit.name;
  return placement;
}

/** "Region › Zone › Woreda › Cluster" for a unit. */
export function unitPath(hierarchy: Hierarchy, unitId: string | null | undefined) {
  return ancestors(hierarchy, unitId).reverse().map((unit) => unit.name).join(" › ");
}

export function unitLabel(unit: OrgUnit) {
  return `${unit.name} (${ORG_LEVEL_LABELS[unit.level]})`;
}
