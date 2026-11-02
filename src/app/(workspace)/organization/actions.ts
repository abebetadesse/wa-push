"use server";

import { guardAction, UserError, type ActionState } from "@/lib/action-result";

import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { activityEvents, authUsers, orgMemberships, orgUnits, schoolMemberships, schools } from "@/db/schema";
import { createCredentialAccount, findUserByEmail, normalizeEmail, validEmail } from "@/lib/accounts";
import { parseCsvRecords } from "@/lib/csv";
import { isDuplicateEntry } from "@/lib/db-errors";
import { formFields } from "@/lib/form-fields";
import { loadHierarchy } from "@/lib/hierarchy";
import { canAdministerUnit, isPlatformAdmin, requireSession, requireUnitAdmin } from "@/lib/permissions";
import { childLevel, ORG_LEVEL_LABELS, ORG_LEVELS, ORG_ROLES, type OrgLevel } from "@/lib/roles";
import { chooseSlug } from "@/lib/slug";

async function loadUnit(unitId: string) {
  const [unit] = await db.select().from(orgUnits).where(eq(orgUnits.id, unitId)).limit(1);
  if (!unit) throw new UserError("That unit no longer exists. Reload the page.");
  return unit;
}

function done(message?: string): ActionState {
  revalidatePath("/organization");
  return message ? { success: message } : {};
}

async function addUnitImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const f = formFields(formData);
  const parentId = f.optionalId("parentId", "a parent unit");
  await requireUnitAdmin(parentId);
  const parent = parentId ? await loadUnit(parentId) : null;
  const level: OrgLevel | null = parent ? childLevel(parent.level) : "region";
  if (!level) throw new UserError("Schools, not units, go inside a cluster. Use “Add a school” instead.");
  const name = f.text("name", `the ${ORG_LEVEL_LABELS[level].toLowerCase()} name`, 160);
  try {
    await db.insert(orgUnits).values({
      level,
      name,
      parentId,
      code: f.optional("code", "the code", 40),
      description: f.optional("description", "the description", 500),
    });
  } catch (error) {
    if (isDuplicateEntry(error)) return { error: `A ${ORG_LEVEL_LABELS[level].toLowerCase()} named ${name} already exists here.` };
    throw error;
  }
  return done(`${ORG_LEVEL_LABELS[level]} ${name} was added.`);
}

/**
 * Creates a school cluster inside a woreda, optionally with its first schools (one name per line),
 * then opens the new cluster.
 */
async function addClusterImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const f = formFields(formData);
  const woreda = await loadUnit(f.id("woredaId", "a woreda"));
  if (woreda.level !== "woreda") throw new UserError("A school cluster goes inside a woreda.");
  const session = await requireUnitAdmin(woreda.id);
  const name = f.text("name", "the cluster name", 160);
  const schoolNames = [...new Set(f.raw("schools").split(/\r?\n/).map((line) => line.trim().slice(0, 180)).filter(Boolean))];
  if (schoolNames.length > 200) throw new UserError("Add at most 200 schools at once; import the rest from CSV.");
  const clusterId = randomUUID();
  try {
    await db.insert(orgUnits).values({
      id: clusterId,
      level: "cluster",
      name,
      parentId: woreda.id,
      code: f.optional("code", "the code", 40),
      description: f.optional("description", "the description", 500),
    });
  } catch (error) {
    if (isDuplicateEntry(error)) return { error: `${woreda.name} already has a cluster named ${name}.` };
    throw error;
  }
  for (const schoolName of schoolNames) {
    const schoolId = randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(schools).values({ id: schoolId, name: schoolName, slug: await chooseSlug(schoolName), orgUnitId: clusterId, country: "Ethiopia", status: "active" });
      if (isPlatformAdmin(session)) await tx.insert(schoolMemberships).values({ schoolId, userId: session.user.id, role: "school_admin" });
      await tx.insert(activityEvents).values({ schoolId, userId: session.user.id, detail: `Created school ${schoolName} in cluster ${name}`.slice(0, 255) });
    });
  }
  revalidatePath("/organization");
  revalidatePath("/");
  redirect(`/organization?unit=${clusterId}`);
}

async function updateUnitImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const f = formFields(formData);
  const unit = await loadUnit(f.id("unitId", "a unit"));
  await requireUnitAdmin(unit.id);
  try {
    await db.update(orgUnits).set({
      name: f.text("name", "the name", 160),
      code: f.optional("code", "the code", 40),
      description: f.optional("description", "the description", 500),
    }).where(eq(orgUnits.id, unit.id));
  } catch (error) {
    if (isDuplicateEntry(error)) return { error: "Another unit with that name already exists at the same place." };
    throw error;
  }
  return done("Saved.");
}

async function deleteUnitImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const f = formFields(formData);
  const unit = await loadUnit(f.id("unitId", "a unit"));
  await requireUnitAdmin(unit.parentId);
  const [child] = await db.select({ id: orgUnits.id }).from(orgUnits).where(eq(orgUnits.parentId, unit.id)).limit(1);
  if (child) throw new UserError("Remove or move the units inside it first.");
  const [school] = await db.select({ id: schools.id }).from(schools).where(eq(schools.orgUnitId, unit.id)).limit(1);
  if (school) throw new UserError("Move its schools to another cluster first.");
  await db.delete(orgUnits).where(eq(orgUnits.id, unit.id));
  return done(`${unit.name} was removed.`);
}

async function addSchoolToClusterImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const f = formFields(formData);
  const cluster = await loadUnit(f.id("unitId", "a cluster"));
  if (cluster.level !== "cluster") throw new UserError("Schools are added to a school cluster.");
  const session = await requireUnitAdmin(cluster.id);
  const name = f.text("name", "the school name", 180);
  const slug = await chooseSlug(name, f.raw("slug").toLowerCase() || null);
  const schoolId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(schools).values({
      id: schoolId,
      name,
      slug,
      orgUnitId: cluster.id,
      schoolCode: f.optional("schoolCode", "the school code", 40),
      kebele: f.optional("kebele", "the kebele", 120),
      country: "Ethiopia",
      status: "active",
    });
    // A super administrator becomes the school's administrator; a unit administrator already is one.
    if (isPlatformAdmin(session)) await tx.insert(schoolMemberships).values({ schoolId, userId: session.user.id, role: "school_admin" });
    await tx.insert(activityEvents).values({ schoolId, userId: session.user.id, detail: `Created school ${name} in cluster ${cluster.name}`.slice(0, 255) });
  });
  return done(`${name} was added to ${cluster.name}. Its public page is /${slug}.`);
}

async function assignSchoolImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const f = formFields(formData);
  const schoolId = f.id("schoolId", "a school");
  const clusterId = f.optionalId("clusterId", "a cluster");
  const session = await requireSession();
  const [school] = await db.select({ id: schools.id, name: schools.name, orgUnitId: schools.orgUnitId }).from(schools).where(eq(schools.id, schoolId)).limit(1);
  if (!school) throw new UserError("School not found.");
  if (clusterId) {
    const cluster = await loadUnit(clusterId);
    if (cluster.level !== "cluster") throw new UserError("Choose a school cluster.");
    if (!(await canAdministerUnit(clusterId))) throw new UserError("You can only move schools into clusters you administer.");
  }
  // Taking a school out of its current cluster needs authority over that cluster; an unplaced school
  // can be placed by its own administrator.
  if (school.orgUnitId) {
    if (!(await canAdministerUnit(school.orgUnitId))) throw new UserError("Only an administrator of the school's current cluster can move it.");
  } else if (!isPlatformAdmin(session)) {
    const [admin] = await db.select({ id: schoolMemberships.id }).from(schoolMemberships)
      .where(and(eq(schoolMemberships.schoolId, schoolId), eq(schoolMemberships.userId, session.user.id), eq(schoolMemberships.role, "school_admin"))).limit(1);
    if (!admin) throw new UserError("Only the school's administrator can place it in a cluster.");
  }
  await db.update(schools).set({ orgUnitId: clusterId }).where(eq(schools.id, schoolId));
  await db.insert(activityEvents).values({ schoolId, userId: session.user.id, detail: clusterId ? `Placed ${school.name} in a school cluster` : `Removed ${school.name} from its cluster` });
  revalidatePath("/");
  return done(clusterId ? `${school.name} was placed in the cluster.` : `${school.name} is no longer in a cluster.`);
}

async function addOrgMemberImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const f = formFields(formData);
  const unit = await loadUnit(f.id("unitId", "a unit"));
  const session = await requireUnitAdmin(unit.id);
  const role = f.choice("role", "a role", ORG_ROLES);
  const email = normalizeEmail(formData.get("email"));
  if (!validEmail(email)) throw new UserError("Enter the person's full email address.");
  const existing = await findUserByEmail(email);
  if (existing?.banned) throw new UserError("That account is suspended or still waiting for approval.");
  let userId = existing?.id;
  if (!userId) {
    const name = f.text("name", "the person's name", 255);
    const password = String(formData.get("password") ?? "");
    if (password.length < 12 || password.length > 128) throw new UserError("Give a first password of at least 12 characters for the new account.");
    userId = await createCredentialAccount({ name, email, password });
  }
  try {
    await db.insert(orgMemberships).values({ orgUnitId: unit.id, userId, role, createdBy: session.user.id });
  } catch (error) {
    if (isDuplicateEntry(error)) return { error: "This person already has a role in this unit. Remove it first to change it." };
    if (!existing) await db.delete(authUsers).where(eq(authUsers.id, userId));
    throw error;
  }
  return done(`${email} is now ${role === "org_admin" ? "an administrator" : "a supervisor"} of ${unit.name}${existing ? "" : ". They can sign in with the password you set"}.`);
}

async function removeOrgMemberImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const f = formFields(formData);
  const membershipId = f.id("membershipId", "a member");
  const [membership] = await db.select().from(orgMemberships).where(eq(orgMemberships.id, membershipId)).limit(1);
  if (!membership) throw new UserError("That role was already removed.");
  const session = await requireUnitAdmin(membership.orgUnitId);
  if (membership.userId === session.user.id && !isPlatformAdmin(session)) throw new UserError("You cannot remove your own role.");
  await db.delete(orgMemberships).where(eq(orgMemberships.id, membershipId));
  return done("The role was removed.");
}

const IMPORT_COLUMNS = ["region", "zone", "woreda", "cluster", "school_name", "school_code", "kebele", "slug"] as const;

/**
 * Builds the hierarchy from a CSV (region, zone, woreda, cluster, school_name, school_code, kebele,
 * slug): missing units are created, and each named school is created in its cluster unless a school
 * with that code or name is already there. Rows outside the units the user administers are refused.
 */
async function importHierarchyImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const file = formData.get("file");
  const text = file instanceof File && file.size > 0 ? await file.text() : String(formData.get("csv") ?? "");
  if (!text.trim()) throw new UserError("Choose a CSV file or paste the rows.");
  if (text.length > 2_000_000) throw new UserError("Import at most 2 MB at a time.");
  const records = parseCsvRecords(text.replace(/^﻿/, ""));
  const header = (records.shift() ?? []).map((cell) => cell.toLowerCase().trim());
  const column = Object.fromEntries(IMPORT_COLUMNS.map((name) => [name, header.indexOf(name)])) as Record<(typeof IMPORT_COLUMNS)[number], number>;
  if (ORG_LEVELS.some((level) => column[level] < 0)) throw new UserError("The first row must name the columns region, zone, woreda and cluster (and optionally school_name, school_code, kebele, slug).");
  if (records.length > 5000) throw new UserError("Import at most 5000 rows at a time.");

  const hierarchy = await loadHierarchy();
  const platformAdmin = isPlatformAdmin(session);
  const units = new Map(hierarchy.units.map((unit) => [`${unit.parentId ?? ""}|${unit.level}|${unit.name.toLowerCase()}`, unit.id]));
  const allowed = new Map<string, boolean>();
  const created = { units: 0, schools: 0 };
  const problems: string[] = [];

  for (const [index, record] of records.entries()) {
    const cell = (name: (typeof IMPORT_COLUMNS)[number]) => (column[name] >= 0 ? (record[column[name]] ?? "").trim() : "");
    const rowNumber = index + 2;
    try {
      let parentId: string | null = null;
      let authorized = platformAdmin;
      for (const level of ORG_LEVELS) {
        const name = cell(level).slice(0, 160);
        if (!name) throw new UserError(`the ${level} is empty`);
        const key = `${parentId ?? ""}|${level}|${name.toLowerCase()}`;
        let unitId = units.get(key);
        if (!unitId) {
          if (!authorized && !(parentId && (allowed.get(parentId) ?? await canAdministerUnit(parentId)))) {
            throw new UserError(`${ORG_LEVEL_LABELS[level]} ${name} is not inside a unit you administer`);
          }
          unitId = randomUUID();
          await db.insert(orgUnits).values({ id: unitId, level, name, parentId });
          units.set(key, unitId);
          created.units += 1;
        }
        if (!authorized) {
          const can: boolean = allowed.get(unitId) ?? await canAdministerUnit(unitId);
          allowed.set(unitId, can);
          authorized = can;
        }
        parentId = unitId;
      }
      if (!authorized) throw new UserError("you do not administer this cluster");
      const schoolName = cell("school_name").slice(0, 180);
      if (!schoolName) continue;
      const code = cell("school_code").slice(0, 40) || null;
      const [existing] = await db.select({ id: schools.id }).from(schools).where(and(
        eq(schools.orgUnitId, parentId!),
        code ? eq(schools.schoolCode, code) : eq(schools.name, schoolName),
      )).limit(1);
      if (existing) continue;
      if (!code) {
        const [unplaced] = await db.select({ id: schools.id }).from(schools).where(and(eq(schools.name, schoolName), isNull(schools.orgUnitId))).limit(1);
        if (unplaced && platformAdmin) {
          await db.update(schools).set({ orgUnitId: parentId }).where(eq(schools.id, unplaced.id));
          continue;
        }
      }
      const schoolId = randomUUID();
      await db.insert(schools).values({
        id: schoolId,
        name: schoolName,
        slug: await chooseSlug(schoolName, cell("slug").toLowerCase() || null),
        orgUnitId: parentId,
        schoolCode: code,
        kebele: cell("kebele").slice(0, 120) || null,
        country: "Ethiopia",
        status: "active",
      });
      if (platformAdmin) await db.insert(schoolMemberships).values({ schoolId, userId: session.user.id, role: "school_admin" });
      created.schools += 1;
    } catch (error) {
      if (problems.length < 15) problems.push(`row ${rowNumber}: ${error instanceof Error ? error.message : "could not be imported"}`);
    }
  }
  revalidatePath("/organization");
  revalidatePath("/");
  const summary = `Created ${created.units} unit${created.units === 1 ? "" : "s"} and ${created.schools} school${created.schools === 1 ? "" : "s"}.`;
  return problems.length ? { error: `${summary} Some rows were skipped — ${problems.join("; ")}.` } : { success: summary };
}

/**
 * Loads Ethiopia's regions, zones and woredas (src/data/ethiopia-admin-units.json, from the national
 * list) into the hierarchy, adding only the ones that are missing. Super administrators only.
 */
async function loadEthiopiaUnitsImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireUnitAdmin(null);
  const regionFilter = String(formData.get("region") ?? "").trim();
  const { default: dataset } = await import("@/data/ethiopia-admin-units.json");
  const hierarchy = await loadHierarchy();
  const existing = new Map(hierarchy.units.map((unit) => [`${unit.parentId ?? ""}|${unit.level}|${unit.name.toLowerCase()}`, unit.id]));
  const rows: { id: string; level: OrgLevel; name: string; parentId: string | null }[] = [];
  const ensure = (level: OrgLevel, name: string, parentId: string | null) => {
    const key = `${parentId ?? ""}|${level}|${name.toLowerCase()}`;
    let unitId = existing.get(key);
    if (!unitId) {
      unitId = randomUUID();
      existing.set(key, unitId);
      rows.push({ id: unitId, level, name: name.slice(0, 160), parentId });
    }
    return unitId;
  };
  for (const region of dataset) {
    if (regionFilter && region.region !== regionFilter) continue;
    const regionId = ensure("region", region.region, null);
    for (const zone of region.zones) {
      const zoneId = ensure("zone", zone.zone, regionId);
      for (const woreda of zone.woredas) ensure("woreda", woreda, zoneId);
    }
  }
  // Parents come before children in `rows`, so batches insert in a valid order.
  for (let start = 0; start < rows.length; start += 500) await db.insert(orgUnits).values(rows.slice(start, start + 500));
  console.log(`[forma] ${session.user.email} loaded ${rows.length} hierarchy units`);
  return done(rows.length ? `Added ${rows.length} regions, zones and woredas. Add school clusters inside each woreda.` : "Every region, zone and woreda in the list is already there.");
}

export async function loadEthiopiaUnits(...args: Parameters<typeof loadEthiopiaUnitsImpl>) { return guardAction(() => loadEthiopiaUnitsImpl(...args)); }
export async function addCluster(...args: Parameters<typeof addClusterImpl>) { return guardAction(() => addClusterImpl(...args)); }
export async function addUnit(...args: Parameters<typeof addUnitImpl>) { return guardAction(() => addUnitImpl(...args)); }
export async function updateUnit(...args: Parameters<typeof updateUnitImpl>) { return guardAction(() => updateUnitImpl(...args)); }
export async function deleteUnit(...args: Parameters<typeof deleteUnitImpl>) { return guardAction(() => deleteUnitImpl(...args)); }
export async function addSchoolToCluster(...args: Parameters<typeof addSchoolToClusterImpl>) { return guardAction(() => addSchoolToClusterImpl(...args)); }
export async function assignSchool(...args: Parameters<typeof assignSchoolImpl>) { return guardAction(() => assignSchoolImpl(...args)); }
export async function addOrgMember(...args: Parameters<typeof addOrgMemberImpl>) { return guardAction(() => addOrgMemberImpl(...args)); }
export async function removeOrgMember(...args: Parameters<typeof removeOrgMemberImpl>) { return guardAction(() => removeOrgMemberImpl(...args)); }
export async function importHierarchy(...args: Parameters<typeof importHierarchyImpl>) { return guardAction(() => importHierarchyImpl(...args)); }
