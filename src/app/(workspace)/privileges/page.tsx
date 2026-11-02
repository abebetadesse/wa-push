import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { StatusForm } from "@/components/status-form";
import { activeTab, PageTabs } from "@/components/page-tabs";
import { RowButton } from "@/components/record-form";
import { SubmitButton } from "@/components/submit-button";
import { ancestors, descendantIds } from "@/lib/hierarchy";
import { getPrivilegeResolver, type PrivilegeScope } from "@/lib/permissions";
import { ACTION_LABELS, allows, PRIVILEGE_ACTIONS, PRIVILEGE_RESOURCES } from "@/lib/privileges";
import { ORG_LEVEL_LABELS, ROLE_LABELS, SCHOOL_ROLES, type SchoolRoleName } from "@/lib/roles";
import { requireWorkspaceContext } from "@/lib/workspace";
import { resetPrivileges, savePrivileges } from "./actions";

export const metadata: Metadata = { title: "Roles & privileges | Forma" };

type SearchParams = Promise<{ scope?: string; role?: string }>;

async function PrivilegesContent({ searchParams }: { searchParams: SearchParams }) {
  const context = await requireWorkspaceContext();
  if (!context.access.privileges) redirect("/no-access");
  const params = await searchParams;
  const resolver = await getPrivilegeResolver();
  const { hierarchy } = resolver;

  // Scopes the user may configure: the platform (super admin), units they administer and the units
  // below them, and schools where they hold the privileges privilege (or run the unit above).
  const administered = new Set<string>(context.platformAdmin ? hierarchy.units.map((unit) => unit.id) : []);
  for (const { unitId, role } of context.orgRoles) if (role === "org_admin") for (const id of descendantIds(hierarchy, unitId)) administered.add(id);
  const schoolScopes = context.schools.filter((school) => context.platformAdmin
    || administered.has(hierarchy.schoolUnit.get(school.id) ?? "")
    || context.roles.some((membership) => membership.schoolId === school.id && allows(resolver.atSchool(school.id, membership.role, "privileges"), "read")));
  const path = (unitId: string) => ancestors(hierarchy, unitId).reverse().map((unit) => unit.name).join(" › ");
  const scopes: { value: string; label: string; scope: PrivilegeScope }[] = [
    ...(context.platformAdmin ? [{ value: "platform", label: "Platform defaults (every school)", scope: { type: "platform", id: "" } as PrivilegeScope }] : []),
    ...[...administered].map((id) => hierarchy.byId.get(id)!)
      .map((unit) => ({ value: `org_unit:${unit.id}`, label: `${ORG_LEVEL_LABELS[unit.level]}: ${path(unit.id)}`, scope: { type: "org_unit", id: unit.id } as PrivilegeScope }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    ...schoolScopes.map((school) => ({ value: `school:${school.id}`, label: `School: ${school.name}`, scope: { type: "school", id: school.id } as PrivilegeScope })),
  ];
  if (scopes.length === 0) redirect("/no-access");
  const current = scopes.find((entry) => entry.value === params.scope) ?? scopes[0];
  // With the national list loaded there are over a thousand woredas: the menu keeps the levels above
  // and clusters, and a woreda is reached from its page in Clusters & hierarchy.
  const menu = scopes.length > 400 ? scopes.filter((entry) => entry === current || !entry.label.startsWith("Woreda:")) : scopes;
  const role = activeTab(params.role, SCHOOL_ROLES) as SchoolRoleName;
  const scope = current.scope;

  // A school's own administrator edits roles below theirs and grants only what they hold.
  const unitAdminHere = context.platformAdmin
    || (scope.type === "org_unit" && administered.has(scope.id))
    || (scope.type === "school" && administered.has(hierarchy.schoolUnit.get(scope.id) ?? ""));
  const myActions = (resource: (typeof PRIVILEGE_RESOURCES)[number]["key"]) => scope.type === "school"
    ? context.roles.filter((membership) => membership.schoolId === scope.id).flatMap((membership) => resolver.atSchool(scope.id, membership.role, resource))
    : [];
  const canEditScope = unitAdminHere || (scope.type === "school"
    && context.roles.some((membership) => membership.schoolId === scope.id && allows(resolver.atSchool(scope.id, membership.role, "privileges"), "edit")));
  const roleLocked = !unitAdminHere && role === "school_admin";
  const editable = canEditScope && !roleLocked;
  const ownSource = scope.type === "platform" ? "platform:" : `${scope.type}:${scope.id}`;
  const describe = (source: string) => {
    if (source === ownSource) return "set here";
    if (source === "default") return "built-in default";
    if (source === "platform:") return "platform default";
    const [type, id] = source.split(":");
    return type === "org_unit" ? `from ${hierarchy.byId.get(id)?.name ?? "a unit above"}` : "from the school";
  };
  const groups = [...new Set(PRIVILEGE_RESOURCES.map((resource) => resource.group))];

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/" className="management-back">← Dashboard</Link>
          <p className="auth-eyebrow">ACCESS MANAGEMENT</p>
          <h1>Roles & privileges</h1>
          <p className="management-description">Choose what each role may view, add, edit, delete, approve, import, export and manage. A school uses its own settings first, then its cluster&apos;s, woreda&apos;s, zone&apos;s and region&apos;s, then the platform defaults set by the super administrator.</p>
        </div>
      </header>

      <Form action="/privileges" className="auth-form attendance-filter">
        <input name="role" type="hidden" value={role} />
        <label>Apply to
          <select defaultValue={current.value} name="scope">
            {menu.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
          </select>
        </label>
        <button className="secondary-button" type="submit">Show</button>
      </Form>

      <PageTabs active={role} basePath="/privileges" params={{ scope: current.value }} tabs={SCHOOL_ROLES.map((value) => ({ id: value, label: ROLE_LABELS[value] }))} />

      <section className="management-card">
        <div className="management-card-heading"><div>
          <h2>{ROLE_LABELS[role]} — {current.label}</h2>
          <p>{editable ? "Tick what this role may do here. “Manage (all)” grants every action." : roleLocked ? "School administrators' privileges are set by the cluster, woreda or super administrator." : "You can view these privileges but not change them."}</p>
        </div></div>
        <StatusForm action={savePrivileges} className="privilege-form">
          <input name="scopeType" type="hidden" value={scope.type} />
          <input name="scopeId" type="hidden" value={scope.id} />
          <input name="role" type="hidden" value={role} />
          <div className="report-table-wrap">
            <table className="report-table privilege-table">
              <thead>
                <tr><th scope="col">Area</th>{PRIVILEGE_ACTIONS.map((action) => <th key={action} scope="col">{ACTION_LABELS[action]}</th>)}<th scope="col">Comes from</th></tr>
              </thead>
              {groups.map((group) => (
                <tbody key={group}>
                  <tr className="privilege-group"><th colSpan={PRIVILEGE_ACTIONS.length + 2} scope="colgroup">{group}</th></tr>
                  {PRIVILEGE_RESOURCES.filter((resource) => resource.group === group).map((resource) => {
                    const actions = resolver.atScope(scope, role, resource.key);
                    const mine = myActions(resource.key);
                    return (
                      <tr key={resource.key}>
                        <th scope="row">{resource.label}</th>
                        {PRIVILEGE_ACTIONS.map((action) => {
                          const on = action === "manage" ? actions.includes("manage") : allows(actions, action);
                          const grantable = unitAdminHere || on || allows(mine, action);
                          return (
                            <td key={action}>
                              <input aria-label={`${ACTION_LABELS[action]} ${resource.label}`} defaultChecked={on} disabled={!editable || !grantable} name={`${resource.key}:${action}`} type="checkbox" />
                              {/* A disabled box is not submitted; keep a granted action that this editor may not touch. */}
                              {editable && !grantable && on && <input name={`${resource.key}:${action}`} type="hidden" value="on" />}
                            </td>
                          );
                        })}
                        <td><small className={resolver.source(scope, role, resource.key) === ownSource ? "privilege-own" : "privilege-inherited"}>{describe(resolver.source(scope, role, resource.key))}</small></td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
          {editable && <div className="inline-actions"><SubmitButton className="primary-button" pendingLabel="Saving…">Save privileges</SubmitButton></div>}
        </StatusForm>
        {editable && <RowButton action={resetPrivileges} confirm={`Make ${ROLE_LABELS[role]} inherit every privilege from above here?`} hidden={{ scopeType: scope.type, scopeId: scope.id, role }} label="Reset this role to inherited" />}
      </section>
    </main>
  );
}

export default function PrivilegesPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<main className="auth-page"><p>Loading privileges...</p></main>}><PrivilegesContent searchParams={searchParams} /></Suspense>;
}
