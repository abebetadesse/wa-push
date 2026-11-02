import type { Metadata } from "next";
import { eq, inArray } from "drizzle-orm";
import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { RecordForm, RowButton } from "@/components/record-form";
import { db } from "@/db";
import { withBasePath } from "@/lib/base-path";
import { authUsers, orgMemberships } from "@/db/schema";
import { ancestors, descendantIds, loadHierarchy, schoolIdsUnder, type OrgUnit } from "@/lib/hierarchy";
import { childLevel, ORG_LEVEL_LABELS, ORG_LEVELS, ORG_ROLE_LABELS, ORG_ROLES, type OrgLevel } from "@/lib/roles";
import { requireWorkspaceContext } from "@/lib/workspace";
import {
  addOrgMember,
  addSchoolToCluster,
  addUnit,
  assignSchool,
  deleteUnit,
  importHierarchy,
  loadEthiopiaUnits,
  removeOrgMember,
  updateUnit,
} from "./actions";

export const metadata: Metadata = { title: "Clusters & hierarchy | Forma" };

type SearchParams = Promise<{ unit?: string; q?: string }>;

const PLURAL: Record<string, string> = { region: "Regions", zone: "Zones", woreda: "Woredas", cluster: "School clusters" };

/** "1 zone", "11 zones", "3 schools" (null level = schools); nothing for 0 units below. */
function countLabel(count: number, level: OrgLevel | null) {
  if (level === null) return `${count} school${count === 1 ? "" : "s"}`;
  if (count === 0) return "";
  return `${count} ${count === 1 ? ORG_LEVEL_LABELS[level].toLowerCase() : PLURAL[level].toLowerCase()}`;
}

async function OrganizationContent({ searchParams }: { searchParams: SearchParams }) {
  const context = await requireWorkspaceContext();
  if (!context.access.organization) redirect("/no-access");
  const params = await searchParams;
  const hierarchy = await loadHierarchy();
  const { platformAdmin } = context;

  // Units the user administers (and everything below them); everyone else with access sees the
  // chain above their own schools, read-only.
  const adminRoots = context.orgRoles.filter((role) => role.role === "org_admin").map((role) => role.unitId);
  const administered = new Set<string>();
  for (const root of adminRoots) for (const id of descendantIds(hierarchy, root)) administered.add(id);
  const visible = new Set<string>(platformAdmin ? hierarchy.units.map((unit) => unit.id) : []);
  for (const { unitId } of context.orgRoles) {
    for (const id of descendantIds(hierarchy, unitId)) visible.add(id);
    for (const unit of ancestors(hierarchy, unitId)) visible.add(unit.id);
  }
  const mySchoolIds = new Set(context.schools.map((school) => school.id));
  for (const school of hierarchy.schools) {
    if (mySchoolIds.has(school.id)) for (const unit of ancestors(hierarchy, school.orgUnitId)) visible.add(unit.id);
  }
  const canAdmin = (unitId: string | null) => platformAdmin || (unitId !== null && administered.has(unitId));

  const schoolCount = new Map<string, number>();
  for (const school of hierarchy.schools) for (const unit of ancestors(hierarchy, school.orgUnitId)) schoolCount.set(unit.id, (schoolCount.get(unit.id) ?? 0) + 1);

  const selected = params.unit && visible.has(params.unit) ? hierarchy.byId.get(params.unit)! : null;
  const children = (selected
    ? hierarchy.children.get(selected.id) ?? []
    : platformAdmin
      ? hierarchy.children.get(null) ?? []
      : [...visible].map((id) => hierarchy.byId.get(id)!).filter((unit) => !unit.parentId || !visible.has(unit.parentId)))
    .filter((unit) => visible.has(unit.id));
  const nextLevel = selected ? childLevel(selected.level) : "region";
  const clusterSchools = selected?.level === "cluster" ? hierarchy.schools.filter((school) => school.orgUnitId === selected.id) : [];
  const schoolsBelow = selected ? new Set(schoolIdsUnder(hierarchy, selected.id)) : null;

  const query = params.q?.trim().toLowerCase() ?? "";
  const matches = query ? hierarchy.units.filter((unit) => visible.has(unit.id) && unit.name.toLowerCase().includes(query)).slice(0, 60) : [];

  const members = selected
    ? await db.select({ id: orgMemberships.id, role: orgMemberships.role, name: authUsers.name, email: authUsers.email, unitId: orgMemberships.orgUnitId })
      .from(orgMemberships).innerJoin(authUsers, eq(orgMemberships.userId, authUsers.id))
      .where(inArray(orgMemberships.orgUnitId, ancestors(hierarchy, selected.id).map((unit) => unit.id)))
    : [];

  // Schools that can be moved into the selected cluster: unplaced schools the user runs, or schools
  // in other clusters they administer.
  const movable = selected?.level === "cluster" && canAdmin(selected.id)
    ? hierarchy.schools.filter((school) => school.orgUnitId !== selected.id && (
      platformAdmin
      || (school.orgUnitId ? administered.has(school.orgUnitId) : context.roles.some((role) => role.schoolId === school.id && role.role === "school_admin"))))
    : [];
  const unplaced = !selected ? hierarchy.schools.filter((school) => !school.orgUnitId && (platformAdmin || mySchoolIds.has(school.id))) : [];
  const clusterOptions = hierarchy.units.filter((unit) => unit.level === "cluster" && canAdmin(unit.id))
    .map((unit) => ({ value: unit.id, label: ancestors(hierarchy, unit.id).reverse().map((part) => part.name).join(" › ") }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const totals = ORG_LEVELS.map((level) => ({ level, count: hierarchy.units.filter((unit) => unit.level === level && visible.has(unit.id)).length }));
  const link = (unit: OrgUnit) => `/organization?unit=${unit.id}`;

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/" className="management-back">← Dashboard</Link>
          <p className="auth-eyebrow">ORGANIZATION</p>
          <h1>Clusters & hierarchy</h1>
          <p className="management-description">Region → Zone → Woreda → School cluster → Schools. Administrators of a unit run every school below it and can add the units, schools, administrators and supervisors under it.</p>
        </div>
        <div className="welcome-actions"><Link className="primary-button" href={selected?.level === "woreda" ? `/organization/add-cluster?woreda=${selected.id}` : "/organization/add-cluster"}>Add a cluster</Link></div>
      </header>

      <div className="textbook-summary">
        {totals.map(({ level, count }) => <div key={level}><strong>{count}</strong><span>{PLURAL[level].toLowerCase()}</span></div>)}
        <div><strong>{selected ? schoolsBelow!.size : hierarchy.schools.filter((school) => platformAdmin || mySchoolIds.has(school.id)).length}</strong><span>schools{selected ? ` in ${selected.name}` : ""}</span></div>
      </div>

      <Form action="/organization" className="auth-form attendance-filter">
        <label>Find a region, zone, woreda or cluster<input defaultValue={params.q} name="q" placeholder="e.g. Kolfe Keraniyo, Genet…" type="search" /></label>
        <button className="secondary-button" type="submit">Search</button>
      </Form>
      {query && (
        <section className="management-card">
          <h2>Search results</h2>
          {matches.length === 0 ? <p className="empty-state">Nothing matches “{params.q}”.</p> : <div className="record-list">{matches.map((unit) => (
            <div className="record-row" key={unit.id}>
              <div><strong><Link href={link(unit)}>{unit.name}</Link></strong><small>{ancestors(hierarchy, unit.parentId).reverse().map((part) => part.name).join(" › ") || "Top level"}</small></div>
              <span className="role-badge">{ORG_LEVEL_LABELS[unit.level]}</span>
            </div>
          ))}</div>}
        </section>
      )}

      <nav aria-label="Hierarchy" className="org-breadcrumb">
        <Link href="/organization">All</Link>
        {selected && ancestors(hierarchy, selected.id).reverse().map((unit) => (
          <span key={unit.id}> › <Link aria-current={unit.id === selected.id ? "page" : undefined} href={link(unit)}>{unit.name}</Link> <small>{ORG_LEVEL_LABELS[unit.level]}</small></span>
        ))}
      </nav>

      <div className="management-sections">
        {nextLevel && (
          <section className="management-card">
            <div className="management-card-heading"><div>
              <h2>{selected ? `${PLURAL[nextLevel]} in ${selected.name}` : platformAdmin ? "Regions" : "Your units"}</h2>
              <p>{children.length} {children.length === 1 ? "unit" : "units"}</p>
            </div></div>
            {children.length === 0 ? <p className="empty-state">None yet.</p> : <div className="org-grid">{children.map((unit) => (
              <Link className="org-tile" href={link(unit)} key={unit.id}>
                <span className="role-badge">{ORG_LEVEL_LABELS[unit.level]}</span>
                <strong>{unit.name}</strong>
                <small>{[countLabel((hierarchy.children.get(unit.id) ?? []).length, childLevel(unit.level)), countLabel(schoolCount.get(unit.id) ?? 0, null), unit.code].filter(Boolean).join(" · ")}</small>
              </Link>
            ))}</div>}
            {canAdmin(selected?.id ?? null) && (
              <>
                <h3 className="org-subheading">Add a {ORG_LEVEL_LABELS[nextLevel].toLowerCase()}</h3>
                <RecordForm action={addUnit} hidden={{ parentId: selected?.id ?? "" }} submitLabel={`Add ${ORG_LEVEL_LABELS[nextLevel].toLowerCase()}`} fields={[
                  { name: "name", label: `${ORG_LEVEL_LABELS[nextLevel]} name`, required: true, max: 160, placeholder: nextLevel === "cluster" ? "Genet cluster" : undefined },
                  { name: "code", label: "Code", max: 40 },
                  { name: "description", label: "Description", max: 500, wide: true },
                ]} />
              </>
            )}
          </section>
        )}

        {selected?.level === "cluster" && (
          <section className="management-card">
            <div className="management-card-heading"><div><h2>Schools in {selected.name}</h2><p>{clusterSchools.length} schools</p></div></div>
            {clusterSchools.length === 0 ? <p className="empty-state">No schools in this cluster yet.</p> : <div className="record-list">{clusterSchools.map((school) => (
              <div className="record-row" key={school.id}>
                <div><strong>{school.name}</strong><small>Public page: <Link href={`/${school.slug}`}>/{school.slug}</Link> · {school.status}</small></div>
                {canAdmin(selected.id) && <RowButton action={assignSchool} confirm={`Remove ${school.name} from ${selected.name}?`} hidden={{ schoolId: school.id, clusterId: "" }} label="Remove from cluster" />}
              </div>
            ))}</div>}
            {canAdmin(selected.id) && (
              <>
                <h3 className="org-subheading">Add a school to this cluster</h3>
                <RecordForm action={addSchoolToCluster} hidden={{ unitId: selected.id }} submitLabel="Add school" fields={[
                  { name: "name", label: "School name", required: true, max: 180, placeholder: "ገነት ቅድመ አንደኛ / Genet Preschool" },
                  { name: "slug", label: "Public address (/school/…)", max: 80, placeholder: "genet-preschool" },
                  { name: "schoolCode", label: "School code", max: 40 },
                  { name: "kebele", label: "Kebele", max: 120 },
                ]} />
                {movable.length > 0 && <>
                  <h3 className="org-subheading">Move an existing school here</h3>
                  <RecordForm action={assignSchool} hidden={{ clusterId: selected.id }} submitLabel="Move into cluster" fields={[
                    { name: "schoolId", label: "School", type: "select", required: true, options: movable.map((school) => ({ value: school.id, label: school.orgUnitId ? `${school.name} (in ${hierarchy.byId.get(school.orgUnitId)?.name ?? "another cluster"})` : school.name })) },
                  ]} />
                </>}
              </>
            )}
          </section>
        )}

        {selected && (
          <section className="management-card">
            <div className="management-card-heading"><div><h2>Administrators & supervisors</h2><p>People with a role here or in a unit above it. Their access covers every school below.</p></div></div>
            {members.length === 0 ? <p className="empty-state">No one has a role here yet.</p> : <div className="record-list">{members.map((member) => (
              <div className="record-row" key={member.id}>
                <div><strong>{member.name}</strong><small>{member.email} · {member.unitId === selected.id ? "this unit" : `from ${hierarchy.byId.get(member.unitId)?.name}`}</small></div>
                <span className="role-badge">{ORG_ROLE_LABELS[member.role]}</span>
                {member.unitId === selected.id && canAdmin(selected.id) && <RowButton action={removeOrgMember} confirm={`Remove ${member.name}'s role?`} danger hidden={{ membershipId: member.id }} label="Remove" />}
              </div>
            ))}</div>}
            {canAdmin(selected.id) && (
              <>
                <h3 className="org-subheading">Give someone a role in {selected.name}</h3>
                <RecordForm action={addOrgMember} hidden={{ unitId: selected.id }} submitLabel="Add" fields={[
                  { name: "email", label: "Email", type: "email", required: true, max: 254 },
                  { name: "role", label: "Role", type: "select", required: true, options: ORG_ROLES.map((role) => ({ value: role, label: `${ORG_ROLE_LABELS[role]} of this ${ORG_LEVEL_LABELS[selected.level].toLowerCase()}` })) },
                  { name: "name", label: "Full name (new accounts)", max: 255 },
                  { name: "password", label: "First password (new accounts, 12+ characters)", type: "password", max: 128 },
                ]} />
              </>
            )}
          </section>
        )}

        {selected && canAdmin(selected.id) && (
          <section className="management-card">
            <h2>Edit {selected.name}</h2>
            <RecordForm action={updateUnit} hidden={{ unitId: selected.id }} resetOnSuccess={false} submitLabel="Save" fields={[
              { name: "name", label: "Name", required: true, max: 160, defaultValue: selected.name },
              { name: "code", label: "Code", max: 40, defaultValue: selected.code ?? "" },
            ]} />
            {canAdmin(selected.parentId) && (hierarchy.children.get(selected.id) ?? []).length === 0 && clusterSchools.length === 0 && (
              <RowButton action={deleteUnit} confirm={`Remove ${selected.name}? This cannot be undone.`} danger hidden={{ unitId: selected.id }} label={`Remove this ${ORG_LEVEL_LABELS[selected.level].toLowerCase()}`} />
            )}
          </section>
        )}

        {!selected && unplaced.length > 0 && clusterOptions.length > 0 && (
          <section className="management-card">
            <div className="management-card-heading"><div><h2>Schools not in a cluster</h2><p>{unplaced.length} schools</p></div></div>
            <div className="record-list">{unplaced.map((school) => (
              <div className="record-row" key={school.id}>
                <div><strong>{school.name}</strong><small>/{school.slug}</small></div>
              </div>
            ))}</div>
            <RecordForm action={assignSchool} submitLabel="Place in cluster" fields={[
              { name: "schoolId", label: "School", type: "select", required: true, options: unplaced.map((school) => ({ value: school.id, label: school.name })) },
              { name: "clusterId", label: "Cluster", type: "select", required: true, options: clusterOptions },
            ]} />
          </section>
        )}

        {!selected && (platformAdmin || adminRoots.length > 0) && (
          <section className="management-card">
            <h2>Import the hierarchy from CSV</h2>
            <p className="management-description">Columns: <code>region, zone, woreda, cluster, school_name, school_code, kebele, slug</code>. Missing units and schools are created; existing ones are kept. Download the <a className="text-link" href={withBasePath("/templates/hierarchy-template.csv")}>hierarchy template</a>.</p>
            <RecordForm action={importHierarchy} submitLabel="Import" pendingLabel="Importing…" fields={[
              { name: "file", label: "CSV file", type: "file", accept: ".csv,text/csv", wide: true },
              { name: "csv", label: "…or paste the rows", type: "textarea", max: 2_000_000 },
            ]} />
          </section>
        )}

        {!selected && platformAdmin && (
          <section className="management-card">
            <h2>Load Ethiopia&apos;s regions, zones and woredas</h2>
            <p className="management-description">Adds the national list of regions, zones and woredas (districts) that are not here yet. Then open a woreda to add its school clusters.</p>
            <RecordForm action={loadEthiopiaUnits} submitLabel="Load list" pendingLabel="Loading…" fields={[
              { name: "region", label: "Only this region (empty = all)", max: 120, placeholder: "Addis Ababa" },
            ]} />
          </section>
        )}
      </div>
    </main>
  );
}

export default function OrganizationPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<main className="auth-page"><p>Loading hierarchy...</p></main>}><OrganizationContent searchParams={searchParams} /></Suspense>;
}
