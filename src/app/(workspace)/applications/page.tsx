import type { Metadata } from "next";
import { and, asc, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { RecordForm, RowButton } from "@/components/record-form";
import { SchoolPicker, selectedSchool } from "@/components/school-picker";
import { SubmitButton } from "@/components/submit-button";
import { db } from "@/db";
import { academicYears, classrooms, schools, studentApplications } from "@/db/schema";
import { requireSchoolsWithPrivilege } from "@/lib/workspace";
import { approveApplication, rejectApplication, updatePublicSettings } from "./actions";

export const metadata: Metadata = { title: "Student applications | Forma" };

type SearchParams = Promise<{ schoolId?: string }>;

async function ApplicationsContent({ searchParams }: { searchParams: SearchParams }) {
  const { schools: visible, schoolIds, can } = await requireSchoolsWithPrivilege("applications");
  const params = await searchParams;
  const schoolId = selectedSchool(params.schoolId, schoolIds);
  const [[school], pending, handled, classes] = await Promise.all([
    db.select().from(schools).where(eq(schools.id, schoolId)).limit(1),
    db.select().from(studentApplications).where(and(eq(studentApplications.schoolId, schoolId), eq(studentApplications.status, "pending"))).orderBy(asc(studentApplications.createdAt)),
    db.select().from(studentApplications).where(eq(studentApplications.schoolId, schoolId)).orderBy(desc(studentApplications.reviewedAt)).limit(50),
    db.select({ id: classrooms.id, name: classrooms.name }).from(classrooms)
      .innerJoin(academicYears, and(eq(classrooms.academicYearId, academicYears.id), eq(academicYears.isCurrent, true)))
      .where(eq(classrooms.schoolId, schoolId)).orderBy(asc(classrooms.name)),
  ]);
  if (!school) redirect("/no-access");
  const mayApprove = can(schoolId, "applications", "approve");

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/" className="management-back">← Dashboard</Link>
          <p className="auth-eyebrow">ADMINISTRATION</p>
          <h1>Student applications</h1>
          <p className="management-description">Students register from the school&apos;s public page. Approving one creates (or links) the student record, places them in a class and switches their account on.</p>
        </div>
      </header>
      <SchoolPicker basePath="/applications" schools={visible} selected={schoolId} />
      <div className="management-sections">
        {can(schoolId, "school_profile", "edit") && (
          <section className="management-card">
            <h2>Public page & registration</h2>
            <p className="management-description">The public page is <Link className="text-link" href={`/${school.slug}`}>/school/{school.slug}</Link> on the live site.</p>
            <RecordForm action={updatePublicSettings} hidden={{ schoolId }} resetOnSuccess={false} submitLabel="Save" fields={[
              { name: "slug", label: "Public address (/school/…)", required: true, max: 80, defaultValue: school.slug },
              { name: "schoolCode", label: "School code", max: 40, defaultValue: school.schoolCode ?? "" },
              { name: "kebele", label: "Kebele", max: 120, defaultValue: school.kebele ?? "" },
              { name: "studentRegistrationOpen", label: "Let students register on the public page", type: "checkbox", defaultValue: school.studentRegistrationOpen ? "on" : "" },
            ]} />
          </section>
        )}
        <section className="management-card">
          <div className="management-card-heading"><div><h2>Waiting for approval</h2><p>{pending.length} applications</p></div></div>
          {pending.length === 0 ? <p className="empty-state">No applications are waiting.</p> : <div className="record-list">{pending.map((application) => (
            <div className="record-row application-row" key={application.id}>
              <div>
                <strong>{application.firstName} {application.lastName}</strong>
                <small>{[application.email, application.gender, application.dateOfBirth && `born ${application.dateOfBirth}`, application.gradeName, application.studentNumber && `no. ${application.studentNumber}`, application.guardianPhone && `guardian ${application.guardianPhone}`, `applied ${application.createdAt.toISOString().slice(0, 10)}`].filter(Boolean).join(" · ")}</small>
                {application.message && <small className="material-text">{application.message}</small>}
              </div>
              {mayApprove && (
                <ActionForm action={approveApplication} className="auth-form outcome-form">
                  <input name="applicationId" type="hidden" value={application.id} />
                  <label>Student number<input defaultValue={application.studentNumber ?? ""} maxLength={80} name="studentNumber" placeholder="assigned automatically" /></label>
                  <label>Class<select defaultValue="" name="classroomId"><option value="">Not yet</option>{classes.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
                  <SubmitButton className="primary-button" pendingLabel="Approving…">Approve</SubmitButton>
                </ActionForm>
              )}
              {mayApprove && <RowButton action={rejectApplication} confirm={`Decline ${application.firstName}'s application?`} danger hidden={{ applicationId: application.id }} label="Decline" />}
            </div>
          ))}</div>}
        </section>
        {handled.some((application) => application.status !== "pending") && (
          <section className="management-card">
            <h2>Recently handled</h2>
            <div className="record-list">{handled.filter((application) => application.status !== "pending").map((application) => (
              <div className="record-row" key={application.id}>
                <div><strong>{application.firstName} {application.lastName}</strong><small>{application.email} · {application.reviewedAt?.toISOString().slice(0, 10)}</small></div>
                <span className={`role-badge status-${application.status === "approved" ? "active" : "inactive"}`}>{application.status}</span>
              </div>
            ))}</div>
          </section>
        )}
      </div>
    </main>
  );
}

export default function ApplicationsPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<main className="auth-page"><p>Loading applications...</p></main>}><ApplicationsContent searchParams={searchParams} /></Suspense>;
}
