"use server";

import { guardAction, UserError, type ActionState } from "@/lib/action-result";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { savedReports, type ReportConfig } from "@/db/schema";
import { buildDataset } from "@/lib/analytics";
import { isSource, type AnalyticsDataset, VISUALS } from "@/lib/analytics-shared";
import { schoolIdsUnder } from "@/lib/hierarchy";
import { getPrivilegeResolver, requireSession } from "@/lib/permissions";
import { allows } from "@/lib/privileges";
import { getWorkspaceContext } from "@/lib/workspace";

/** The data behind a report, limited to schools where the viewer's role may read reports. */
export async function loadDataset(source: string, scope: { unitId: string | null; schoolId: string | null }, period: string): Promise<{ data?: AnalyticsDataset; error?: string }> {
  try {
    if (!isSource(source)) throw new UserError("Choose a data source.");
    const context = await getWorkspaceContext();
    if (!context) throw new UserError("Your session has expired. Sign in again.");
    const resolver = await getPrivilegeResolver();
    const rolesAt = (schoolId: string) => context.roles.filter((membership) => membership.schoolId === schoolId).map(({ role }) => role);
    let schoolIds = context.schools.map((school) => school.id)
      .filter((schoolId) => context.platformAdmin || rolesAt(schoolId).some((role) => allows(resolver.atSchool(schoolId, role, "reports"), "read")));
    if (scope.schoolId) schoolIds = schoolIds.filter((id) => id === scope.schoolId);
    else if (scope.unitId) {
      const under = new Set(schoolIdsUnder(resolver.hierarchy, scope.unitId));
      schoolIds = schoolIds.filter((id) => under.has(id));
    }
    const unitId = scope.schoolId ? resolver.hierarchy.schoolUnit.get(scope.schoolId) ?? null : scope.unitId;
    const data = await buildDataset(source, { schoolIds, unitId, period: String(period ?? "").slice(0, 20) }, resolver.hierarchy, {
      platformAdmin: context.platformAdmin,
      rolesAt,
      resolver,
    });
    return { data };
  } catch (error) {
    return { error: error instanceof UserError ? error.message : "The data could not be loaded. Try again." + (error instanceof Error ? ` (${error.message.slice(0, 120)})` : "") };
  }
}

function readConfig(raw: string): ReportConfig {
  let config: ReportConfig;
  try { config = JSON.parse(raw); } catch { throw new UserError("The report could not be read."); }
  if (!config || !isSource(config.source) || !VISUALS.some((visual) => visual.key === config.visual)) throw new UserError("The report is incomplete.");
  if (raw.length > 20_000) throw new UserError("The report has too many settings.");
  return config;
}

async function saveReportImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const context = await getWorkspaceContext();
  if (!context?.access.analytics) throw new UserError("Your role may not build reports.");
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 160) throw new UserError("Name the report (up to 160 characters).");
  const config = readConfig(String(formData.get("config") ?? ""));
  const values = {
    name,
    description: String(formData.get("description") ?? "").trim().slice(0, 500) || null,
    config,
    isShared: formData.get("isShared") === "on",
    pinned: formData.get("pinned") === "on",
  };
  const reportId = String(formData.get("reportId") ?? "");
  if (reportId) {
    const result = await db.update(savedReports).set(values).where(and(eq(savedReports.id, reportId), eq(savedReports.ownerId, session.user.id)));
    if (!(result[0] as { affectedRows?: number }).affectedRows) throw new UserError("Only the report's author can change it. Save it under a new name instead.");
  } else {
    await db.insert(savedReports).values({ ...values, ownerId: session.user.id });
  }
  revalidatePath("/analytics");
  return { success: `“${name}” was saved${values.pinned ? " and pinned to the dashboard" : ""}.` };
}

async function updateReportImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const reportId = String(formData.get("reportId") ?? "");
  const step = String(formData.get("step") ?? "");
  const where = and(eq(savedReports.id, reportId), eq(savedReports.ownerId, session.user.id));
  if (step === "delete") await db.delete(savedReports).where(where);
  else if (step === "pin" || step === "unpin") await db.update(savedReports).set({ pinned: step === "pin" }).where(where);
  else if (step === "share" || step === "unshare") await db.update(savedReports).set({ isShared: step === "share" }).where(where);
  else throw new UserError("Unknown change.");
  revalidatePath("/analytics");
  return {};
}

export async function saveReport(...args: Parameters<typeof saveReportImpl>) { return guardAction(() => saveReportImpl(...args)); }
export async function updateReport(...args: Parameters<typeof updateReportImpl>) { return guardAction(() => updateReportImpl(...args)); }
