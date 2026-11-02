import type { Metadata } from "next";
import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CertificateView } from "@/components/certificate-view";
import { activeTab, PageTabs } from "@/components/page-tabs";
import { RowButton } from "@/components/record-form";
import { StatusForm } from "@/components/status-form";
import { SubmitButton } from "@/components/submit-button";
import { db } from "@/db";
import { academicYears, certificates, certificateTemplates, classrooms, enrollments } from "@/db/schema";
import { sampleData } from "@/lib/certificates";
import { fieldsForSchool } from "@/lib/field-data";
import { entityRecords } from "@/lib/field-records";
import { descendantIds, schoolAncestors } from "@/lib/hierarchy";
import { getPrivilegeResolver } from "@/lib/permissions";
import { allows, type PrivilegeAction } from "@/lib/privileges";
import { ORG_LEVEL_LABELS } from "@/lib/roles";
import { requireWorkspaceContext } from "@/lib/workspace";
import { archiveTemplate, issueCertificates, revokeCertificate, saveTemplate } from "./actions";
import { CertificateDesigner } from "./certificate-designer";

export const metadata: Metadata = { title: "Certificates | Forma" };

const TABS = ["issue", "templates", "issued"] as const;
type SearchParams = Promise<{ tab?: string; schoolId?: string; template?: string; classroom?: string; edit?: string }>;

async function CertificatesContent({ searchParams }: { searchParams: SearchParams }) {
  const context = await requireWorkspaceContext();
  if (!context.access.certificates) redirect("/no-access");
  const params = await searchParams;
  const tab = activeTab(params.tab, TABS);
  const resolver = await getPrivilegeResolver();
  const { hierarchy } = resolver;
  const can = (schoolId: string, action: PrivilegeAction) => context.platformAdmin
    || context.roles.some((membership) => membership.schoolId === schoolId && membership.role !== "student" && membership.role !== "guardian" && allows(resolver.atSchool(schoolId, membership.role, "certificates"), action));
  const schools = context.schools.filter((school) => can(school.id, "read"));
  if (schools.length === 0) redirect("/no-access");
  const schoolId = schools.find((school) => school.id === params.schoolId)?.id ?? schools[0].id;

  const units = schoolAncestors(hierarchy, schoolId).map((unit) => unit.id);
  const templates = await db.select().from(certificateTemplates).where(or(
    eq(certificateTemplates.scopeType, "platform"),
    units.length ? and(eq(certificateTemplates.scopeType, "org_unit"), inArray(certificateTemplates.scopeId, units)) : undefined,
    and(eq(certificateTemplates.scopeType, "school"), eq(certificateTemplates.scopeId, schoolId)),
  )).orderBy(asc(certificateTemplates.name));
  const active = templates.filter((template) => template.isActive);

  const administered = new Set<string>(context.platformAdmin ? hierarchy.units.map((unit) => unit.id) : []);
  for (const { unitId, role } of context.orgRoles) if (role === "org_admin") for (const id of descendantIds(hierarchy, unitId)) administered.add(id);
  const templateScopes = [
    { value: `school:${schoolId}`, label: `This school: ${schools.find((school) => school.id === schoolId)?.name}` },
    ...schoolAncestors(hierarchy, schoolId).filter((unit) => administered.has(unit.id)).map((unit) => ({ value: `org_unit:${unit.id}`, label: `Every school in ${ORG_LEVEL_LABELS[unit.level].toLowerCase()} ${unit.name}` })),
    ...(context.platformAdmin ? [{ value: "platform", label: "Every school (platform)" }] : []),
  ];
  const mayEditTemplate = (template: typeof templates[number]) => template.scopeType === "platform" ? context.platformAdmin
    : template.scopeType === "org_unit" ? administered.has(template.scopeId) : can(schoolId, "edit");
  const keep = { schoolId };
  const picker = schools.length > 1 && (
    <Form action="/certificates" className="auth-form attendance-filter">
      <input name="tab" type="hidden" value={tab} />
      <label>School<select defaultValue={schoolId} name="schoolId">{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
      <button className="secondary-button" type="submit">Show</button>
    </Form>
  );

  let body;
  if (tab === "templates") {
    const editing = templates.find((template) => template.id === params.edit && mayEditTemplate(template));
    const customKeys = [...new Set((await Promise.all(["student", "teacher", "staff"].map((entity) => fieldsForSchool(schoolId, entity as "student")))).flat().map((field) => field.fieldKey))];
    body = <>
      {(can(schoolId, "add") || editing) && (
        <section className="management-card">
          <h2>{editing ? `Edit “${editing.name}”` : "Design a certificate"}</h2>
          <CertificateDesigner action={saveTemplate} customKeys={customKeys} initial={editing ? { id: editing.id, name: editing.name, audience: editing.audience, design: editing.design, elements: editing.elements, variables: editing.variables } : undefined} key={editing?.id ?? "new"} scopes={templateScopes} />
        </section>
      )}
      <section className="management-card">
        <div className="management-card-heading"><div><h2>Templates</h2><p>{templates.length} available at this school</p></div></div>
        {templates.length === 0 ? <p className="empty-state">No templates yet.</p> : <div className="template-gallery">{templates.map((template) => (
          <article className={`template-card${template.isActive ? "" : " field-inactive"}`} key={template.id}>
            <div className="template-thumb"><CertificateView data={sampleData(template.variables)} design={template.design} elements={template.elements} /></div>
            <strong>{template.name}</strong>
            <small>{template.audience}s · {template.scopeType === "platform" ? "every school" : template.scopeType === "org_unit" ? hierarchy.byId.get(template.scopeId)?.name : "this school"}{template.isActive ? "" : " · archived"}</small>
            {mayEditTemplate(template) && (
              <span className="inline-actions">
                <Link className="secondary-button record-action" href={`/certificates?tab=templates&schoolId=${schoolId}&edit=${template.id}`}>Edit</Link>
                <RowButton action={archiveTemplate} hidden={{ templateId: template.id, active: template.isActive ? "" : "on" }} label={template.isActive ? "Archive" : "Restore"} />
              </span>
            )}
          </article>
        ))}</div>}
      </section>
    </>;
  } else if (tab === "issue") {
    const template = active.find((candidate) => candidate.id === params.template) ?? active[0];
    const audience = template?.audience ?? "student";
    let people = await entityRecords(audience === "student" ? "student" : audience === "teacher" ? "teacher" : "staff", [schoolId]);
    people = people.filter((person) => person.status === "active");
    const classes = audience === "student" ? await db.select({ id: classrooms.id, name: classrooms.name }).from(classrooms)
      .innerJoin(academicYears, and(eq(classrooms.academicYearId, academicYears.id), eq(academicYears.isCurrent, true)))
      .where(eq(classrooms.schoolId, schoolId)).orderBy(asc(classrooms.name)) : [];
    if (audience === "student" && params.classroom) {
      const enrolled = new Set((await db.select({ studentId: enrollments.studentId }).from(enrollments).where(eq(enrollments.classroomId, params.classroom))).map((row) => row.studentId));
      people = people.filter((person) => enrolled.has(person.id));
    }
    body = !template ? <p className="empty-state">Create a template first, in the Templates tab.</p> : <>
      <Form action="/certificates" className="auth-form attendance-filter">
        <input name="tab" type="hidden" value="issue" />
        <input name="schoolId" type="hidden" value={schoolId} />
        <label>Template<select defaultValue={template.id} name="template">{active.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} ({candidate.audience}s)</option>)}</select></label>
        {classes.length > 0 && <label>Class<select defaultValue={params.classroom ?? ""} name="classroom"><option value="">All students</option>{classes.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>}
        <button className="secondary-button" type="submit">Show</button>
      </Form>
      <section className="management-card">
        <h2>Issue “{template.name}”</h2>
        {!can(schoolId, "add") ? <p className="empty-state">Your role may view certificates here but not issue them.</p> : (
          <StatusForm action={issueCertificates} className="auth-form">
            <input name="schoolId" type="hidden" value={schoolId} />
            <input name="templateId" type="hidden" value={template.id} />
            {template.variables.length > 0 && <div className="form-two-columns">{template.variables.map((variable) => (
              <label key={variable.key}>{variable.label}<input defaultValue={variable.defaultValue} maxLength={300} name={`var.${variable.key}`} /></label>
            ))}</div>}
            <fieldset className="recipient-list">
              <legend>{people.length} {audience}s — tick who receives it</legend>
              {people.length === 0 ? <p className="empty-state">No active {audience}s{params.classroom ? " in this class" : ""}.</p> : people.map((person) => (
                <label className="checkbox-label" key={person.id}><input name="recipientIds" type="checkbox" value={person.id} /> {person.name} <small>{person.number}</small></label>
              ))}
            </fieldset>
            <SubmitButton className="primary-button" pendingLabel="Issuing…">Issue certificates</SubmitButton>
          </StatusForm>
        )}
      </section>
    </>;
  } else {
    const issued = await db.select().from(certificates).where(eq(certificates.schoolId, schoolId)).orderBy(desc(certificates.issuedAt)).limit(500);
    const templateName = new Map(templates.map((template) => [template.id, template.name]));
    body = (
      <section className="management-card">
        <div className="management-card-heading"><div><h2>Issued certificates</h2><p>{issued.length} most recent · each can be checked at /verify/&lt;code&gt;</p></div></div>
        {issued.length === 0 ? <p className="empty-state">None issued yet.</p> : <>
          <Form action="/certificates/print" className="auth-form" id="print-certificates" />
          <div className="record-list">{issued.map((certificate) => (
            <div className="record-row" key={certificate.id}>
              <input aria-label={`Select ${certificate.recipientName}`} form="print-certificates" name="ids" type="checkbox" value={certificate.id} />
              <div><strong>{certificate.recipientName}</strong><small>{[templateName.get(certificate.templateId), certificate.serial, `code ${certificate.verificationCode}`, certificate.issuedAt.toISOString().slice(0, 10), certificate.revokedAt && "revoked"].filter(Boolean).join(" · ")}</small></div>
              <span className="inline-actions">
                <Link className="secondary-button record-action" href={`/certificates/print?ids=${certificate.id}`}>Print</Link>
                {can(schoolId, "delete") && <RowButton action={revokeCertificate} confirm={certificate.revokedAt ? undefined : "Revoke this certificate? Verification will show it as revoked."} danger={!certificate.revokedAt} hidden={{ certificateId: certificate.id, restore: certificate.revokedAt ? "on" : "" }} label={certificate.revokedAt ? "Restore" : "Revoke"} />}
              </span>
            </div>
          ))}</div>
          <button className="primary-button" form="print-certificates" type="submit">Print selected</button>
        </>}
      </section>
    );
  }

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/" className="management-back">← Dashboard</Link>
          <p className="auth-eyebrow">DATA & REPORTS</p>
          <h1>Certificates</h1>
          <p className="management-description">Design certificates with your own text, placeholders, data fields, signatures, seals and colours; issue them to students, teachers or staff in bulk; print them; and let anyone check a certificate&apos;s code online.</p>
        </div>
      </header>
      {picker}
      <PageTabs active={tab} basePath="/certificates" params={keep} tabs={[
        { id: "issue", label: "Issue" },
        { id: "templates", label: "Templates", count: templates.length },
        { id: "issued", label: "Issued" },
      ]} />
      <div className="management-sections">{body}</div>
    </main>
  );
}

export default function CertificatesPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<main className="auth-page"><p>Loading certificates...</p></main>}><CertificatesContent searchParams={searchParams} /></Suspense>;
}
