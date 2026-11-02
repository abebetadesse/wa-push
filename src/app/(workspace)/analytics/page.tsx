import type { Metadata } from "next";
import { desc, eq, or } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { activeTab, PageTabs } from "@/components/page-tabs";
import { RowButton } from "@/components/record-form";
import { db } from "@/db";
import { authUsers, savedReports } from "@/db/schema";
import { ANALYTICS_SOURCES, VISUALS } from "@/lib/analytics-shared";
import { currentEthiopianYear, knownPeriods } from "@/lib/field-data";
import { ancestors } from "@/lib/hierarchy";
import { getPrivilegeResolver } from "@/lib/permissions";
import { allows } from "@/lib/privileges";
import { ORG_LEVEL_LABELS, ORG_LEVELS } from "@/lib/roles";
import { requireWorkspaceContext } from "@/lib/workspace";
import { updateReport } from "./actions";
import { DashboardTile, ReportBuilder, type SavedReport, type ScopeOption } from "./report-builder";

export const metadata: Metadata = { title: "Analytics | Forma" };

const TABS = ["builder", "dashboard", "saved"] as const;
type SearchParams = Promise<{ tab?: string; report?: string }>;

async function AnalyticsContent({ searchParams }: { searchParams: SearchParams }) {
  const context = await requireWorkspaceContext();
  if (!context.access.analytics) redirect("/no-access");
  const params = await searchParams;
  const tab = activeTab(params.tab, TABS);
  const resolver = await getPrivilegeResolver();
  const { hierarchy } = resolver;
  const schoolIds = context.schools.map((school) => school.id).filter((schoolId) => context.platformAdmin
    || context.roles.some((membership) => membership.schoolId === schoolId && allows(resolver.atSchool(schoolId, membership.role, "reports"), "read")));

  // Scopes: everything the viewer can report on, each hierarchy unit above those schools, and each school.
  const units = new Map<string, number>();
  for (const schoolId of schoolIds) for (const unit of ancestors(hierarchy, hierarchy.schoolUnit.get(schoolId))) units.set(unit.id, (units.get(unit.id) ?? 0) + 1);
  const unitOptions: ScopeOption[] = [...units.entries()]
    .map(([id, count]) => ({ unit: hierarchy.byId.get(id)!, count }))
    .sort((a, b) => ORG_LEVELS.indexOf(a.unit.level) - ORG_LEVELS.indexOf(b.unit.level) || a.unit.name.localeCompare(b.unit.name))
    .map(({ unit, count }) => ({ value: `unit:${unit.id}`, label: `${ORG_LEVEL_LABELS[unit.level]}: ${unit.name} (${count} schools)`, unitId: unit.id, schoolId: null }));
  const scopes: ScopeOption[] = [
    { value: "all", label: `All my schools (${schoolIds.length})`, unitId: null, schoolId: null },
    ...unitOptions,
    ...context.schools.filter((school) => schoolIds.includes(school.id)).map((school) => ({ value: `school:${school.id}`, label: `School: ${school.name}`, unitId: null, schoolId: school.id })),
  ];
  const periods = [...new Set([currentEthiopianYear(), ...await knownPeriods(schoolIds)])];

  const rows = await db.select({
    id: savedReports.id, name: savedReports.name, description: savedReports.description, config: savedReports.config,
    isShared: savedReports.isShared, pinned: savedReports.pinned, ownerId: savedReports.ownerId, owner: authUsers.name, updatedAt: savedReports.updatedAt,
  }).from(savedReports).innerJoin(authUsers, eq(savedReports.ownerId, authUsers.id))
    .where(or(eq(savedReports.ownerId, context.userId), eq(savedReports.isShared, true)))
    .orderBy(desc(savedReports.updatedAt)).limit(300);
  const saved: (SavedReport & { owner: string; updatedAt: Date })[] = rows.map((row) => ({ ...row, mine: row.ownerId === context.userId }));
  const opened = saved.find((report) => report.id === params.report);
  const pinned = saved.filter((report) => report.pinned && report.mine);

  return (
    <main className="management-page analytics-page">
      <header className="management-header">
        <div>
          <Link href="/" className="management-back">← Dashboard</Link>
          <p className="auth-eyebrow">DATA & REPORTS</p>
          <h1>Analytics</h1>
          <p className="management-description">Build reports across regions, zones, woredas, clusters and schools: choose the data, group it, pick values and filters, and show it as a table, matrix, chart, KPI cards or heat map. Save reports, share them and pin them to a dashboard. Everyone sees only the schools their role may report on.</p>
        </div>
      </header>
      <PageTabs active={tab} basePath="/analytics" tabs={[
        { id: "builder", label: opened ? `Edit: ${opened.name}` : "Report builder" },
        { id: "dashboard", label: "My dashboard", count: pinned.length },
        { id: "saved", label: "Saved reports", count: saved.length },
      ]} params={opened ? { report: opened.id } : {}} />

      {tab === "builder" && <ReportBuilder initial={opened} key={opened?.id ?? "new"} periods={periods} saved={saved} scopes={scopes} />}

      {tab === "dashboard" && (pinned.length === 0
        ? <p className="empty-state">Nothing pinned yet. Save a report with “Pin to my dashboard”.</p>
        : <div className="dashboard-grid-reports">{pinned.map((report) => <DashboardTile key={report.id} report={report} />)}</div>)}

      {tab === "saved" && (
        <section className="management-card">
          {saved.length === 0 ? <p className="empty-state">No saved reports yet.</p> : <div className="record-list">{saved.map((report) => (
            <div className="record-row" key={report.id}>
              <div>
                <strong><Link href={`/analytics?tab=builder&report=${report.id}`}>{report.name}</Link></strong>
                <small>{[ANALYTICS_SOURCES.find((source) => source.key === report.config.source)?.label, VISUALS.find((visual) => visual.key === report.config.visual)?.label, report.mine ? "yours" : `by ${report.owner}`, report.isShared && "shared", report.pinned && report.mine && "pinned", report.updatedAt.toISOString().slice(0, 10)].filter(Boolean).join(" · ")}</small>
                {report.description && <small>{report.description}</small>}
              </div>
              {report.mine && (
                <span className="inline-actions">
                  <RowButton action={updateReport} hidden={{ reportId: report.id, step: report.pinned ? "unpin" : "pin" }} label={report.pinned ? "Unpin" : "Pin"} />
                  <RowButton action={updateReport} hidden={{ reportId: report.id, step: report.isShared ? "unshare" : "share" }} label={report.isShared ? "Stop sharing" : "Share"} />
                  <RowButton action={updateReport} confirm={`Delete “${report.name}”?`} danger hidden={{ reportId: report.id, step: "delete" }} label="Delete" />
                </span>
              )}
            </div>
          ))}</div>}
        </section>
      )}
    </main>
  );
}

export default function AnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<main className="auth-page"><p>Loading analytics...</p></main>}><AnalyticsContent searchParams={searchParams} /></Suspense>;
}
