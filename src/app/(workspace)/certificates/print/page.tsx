import type { Metadata } from "next";
import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { CertificateView } from "@/components/certificate-view";
import { db } from "@/db";
import { certificates, certificateTemplates, staffMembers, students, teachers } from "@/db/schema";
import { getPrivilegeResolver } from "@/lib/permissions";
import { allows } from "@/lib/privileges";
import { requireWorkspaceContext } from "@/lib/workspace";
import { PrintButton } from "../../students/[id]/report-card/print-button";

export const metadata: Metadata = { title: "Print certificates | Forma" };

type SearchParams = Promise<{ ids?: string | string[] }>;

async function PrintContent({ searchParams }: { searchParams: SearchParams }) {
  const context = await requireWorkspaceContext();
  const params = await searchParams;
  const ids = (Array.isArray(params.ids) ? params.ids : (params.ids ?? "").split(",")).filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 200);
  const rows = ids.length ? await db.select().from(certificates).where(inArray(certificates.id, ids)) : [];
  const resolver = await getPrivilegeResolver();

  // Staff with the certificate privilege at the school, or the person the certificate was issued to.
  const ownIds = new Set<string>();
  for (const table of [students, teachers, staffMembers]) {
    for (const row of await db.select({ id: table.id }).from(table).where(eq(table.userId, context.userId))) ownIds.add(row.id);
  }
  const allowed = rows.filter((certificate) => context.platformAdmin
    || ownIds.has(certificate.recipientId)
    || context.roles.some((membership) => membership.schoolId === certificate.schoolId && membership.role !== "student" && membership.role !== "guardian" && allows(resolver.atSchool(certificate.schoolId, membership.role, "certificates"), "read")));
  const templates = allowed.length ? await db.select().from(certificateTemplates).where(inArray(certificateTemplates.id, [...new Set(allowed.map((certificate) => certificate.templateId))])) : [];
  const templateById = new Map(templates.map((template) => [template.id, template]));
  const orientation = templateById.get(allowed[0]?.templateId ?? "")?.design.orientation ?? "landscape";

  return (
    <main className="certificate-print">
      <style>{`@page { size: A4 ${orientation}; margin: 0; }`}</style>
      <div className="print-hide certificate-print-bar">
        <Link className="management-back" href={context.access.certificates ? "/certificates?tab=issued" : "/my-progress"}>← Back</Link>
        <span>{allowed.length} certificate{allowed.length === 1 ? "" : "s"}</span>
        <PrintButton />
      </div>
      {allowed.length === 0 && <p className="empty-state">No certificates to print.</p>}
      {allowed.map((certificate) => {
        const template = templateById.get(certificate.templateId);
        if (!template) return null;
        return (
          <section className="certificate-page" key={certificate.id}>
            {certificate.revokedAt && <p className="certificate-revoked print-hide">This certificate was revoked on {certificate.revokedAt.toISOString().slice(0, 10)}.</p>}
            <CertificateView data={certificate.data} design={template.design} elements={template.elements} />
          </section>
        );
      })}
    </main>
  );
}

export default function PrintCertificatesPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<main className="auth-page"><p>Preparing certificates...</p></main>}><PrintContent searchParams={searchParams} /></Suspense>;
}
