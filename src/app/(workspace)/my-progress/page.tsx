import type { Metadata } from "next";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Fragment, Suspense } from "react";
import { db } from "@/db";
import {
  academicYears,
  assessmentAttempts,
  assessmentResults,
  assessments,
  attendanceRecords,
  certificates,
  certificateTemplates,
  classrooms,
  enrollments,
  gradeLevels,
  schoolMemberships,
  schools,
  students,
  subjects,
} from "@/db/schema";
import { formatFieldValue, isValueField, FILE_TYPES, withFormulas } from "@/lib/custom-fields";
import { currentEthiopianYear, fieldsForSchool, loadFieldValues } from "@/lib/field-data";
import { getSession } from "@/lib/permissions";

export const metadata: Metadata = { title: "My progress | Forma" };

const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : null);

async function MyProgressContent() {
  const session = await getSession();
  if (!session) redirect("/login");
  const records = await db.select({ id: students.id, schoolId: students.schoolId, firstName: students.firstName, lastName: students.lastName, number: students.studentNumber, schoolName: schools.name })
    .from(students)
    .innerJoin(schools, eq(students.schoolId, schools.id))
    .innerJoin(schoolMemberships, and(eq(schoolMemberships.userId, session.user.id), eq(schoolMemberships.schoolId, students.schoolId), eq(schoolMemberships.role, "student")))
    .where(and(eq(students.userId, session.user.id), eq(students.status, "active")));
  if (records.length === 0) redirect("/no-access");
  const ids = records.map((record) => record.id);

  const [placement, attendance, monthly, marked, attempts, issued] = await Promise.all([
    db.select({ studentId: enrollments.studentId, grade: gradeLevels.name, classroom: classrooms.name, year: academicYears.name })
      .from(enrollments)
      .innerJoin(academicYears, and(eq(enrollments.academicYearId, academicYears.id), eq(academicYears.isCurrent, true)))
      .innerJoin(classrooms, eq(enrollments.classroomId, classrooms.id))
      .innerJoin(gradeLevels, eq(classrooms.gradeLevelId, gradeLevels.id))
      .where(inArray(enrollments.studentId, ids)),
    db.select({ status: attendanceRecords.status, total: sql<number>`COUNT(*)` }).from(attendanceRecords).where(inArray(attendanceRecords.studentId, ids)).groupBy(attendanceRecords.status),
    db.select({ month: sql<string>`DATE_FORMAT(${attendanceRecords.date}, '%Y-%m')`, present: sql<number>`SUM(${attendanceRecords.status} IN ('present','late'))`, total: sql<number>`COUNT(*)` })
      .from(attendanceRecords).where(inArray(attendanceRecords.studentId, ids))
      .groupBy(sql`DATE_FORMAT(${attendanceRecords.date}, '%Y-%m')`).orderBy(sql`DATE_FORMAT(${attendanceRecords.date}, '%Y-%m')`),
    db.select({ title: assessments.title, subject: subjects.name, score: assessmentResults.score, maxScore: assessments.maxScore, feedback: assessmentResults.feedback, at: assessmentResults.createdAt })
      .from(assessmentResults).innerJoin(assessments, eq(assessmentResults.assessmentId, assessments.id)).innerJoin(subjects, eq(assessments.subjectId, subjects.id))
      .where(inArray(assessmentResults.studentId, ids)).orderBy(desc(assessmentResults.createdAt)).limit(100),
    db.select({ title: assessments.title, subject: subjects.name, score: assessmentAttempts.score, maxScore: assessmentAttempts.maxScore, at: assessmentAttempts.submittedAt })
      .from(assessmentAttempts).innerJoin(assessments, eq(assessmentAttempts.assessmentId, assessments.id)).innerJoin(subjects, eq(assessments.subjectId, subjects.id))
      .where(inArray(assessmentAttempts.studentId, ids)).orderBy(desc(assessmentAttempts.submittedAt)).limit(100),
    db.select({ id: certificates.id, name: certificateTemplates.name, serial: certificates.serial, issuedAt: certificates.issuedAt, revokedAt: certificates.revokedAt })
      .from(certificates).innerJoin(certificateTemplates, eq(certificates.templateId, certificateTemplates.id))
      .where(and(eq(certificates.recipientType, "student"), inArray(certificates.recipientId, ids))).orderBy(desc(certificates.issuedAt)),
  ]);

  const counts = Object.fromEntries(attendance.map((row) => [row.status, Number(row.total)]));
  const recorded = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const attendanceRate = percent((counts.present ?? 0) + (counts.late ?? 0), recorded);
  const results = [...marked.map((row) => ({ ...row, kind: "Marked" })), ...attempts.map((row) => ({ ...row, feedback: null, kind: "Online" }))]
    .map((row) => ({ ...row, percent: percent(row.score, row.maxScore) }))
    .sort((a, b) => b.at.getTime() - a.at.getTime());
  const bySubject = [...new Set(results.map((row) => row.subject))].map((subject) => {
    const rows = results.filter((row) => row.subject === subject && row.percent !== null);
    return { subject, average: rows.length ? Math.round(rows.reduce((sum, row) => sum + row.percent!, 0) / rows.length * 10) / 10 : null, count: rows.length };
  }).sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
  const overall = results.filter((row) => row.percent !== null);
  const average = overall.length ? Math.round(overall.reduce((sum, row) => sum + row.percent!, 0) / overall.length * 10) / 10 : null;

  // Fields an administrator chose to show to students.
  const period = currentEthiopianYear();
  const shared = await Promise.all(records.map(async (record) => {
    const fields = (await fieldsForSchool(record.schoolId, "student")).filter((field) => field.viewRoles?.includes("student") && isValueField(field.fieldType) && !FILE_TYPES.includes(field.fieldType));
    const values = await loadFieldValues(fields, [record.id], period);
    const filled = withFormulas(fields, values.get(record.id) ?? new Map());
    return { record, fields: fields.map((field) => ({ label: field.label, value: formatFieldValue(field, filled.get(field.fieldKey)) })).filter((entry) => entry.value) };
  }));
  const me = records[0];
  const where = placement.find((row) => row.studentId === me.id);

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <p className="auth-eyebrow">MY PROGRESS</p>
          <h1>{me.firstName} {me.lastName}</h1>
          <p className="management-description">{[me.schoolName, where && `${where.grade} · ${where.classroom}`, where?.year, `Student no. ${me.number}`].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="welcome-actions">
          <Link className="secondary-button" href="/my-learning">My assessments</Link>
          <Link className="primary-button" href="/discussions">Discussions</Link>
        </div>
      </header>

      <div className="textbook-summary">
        <div><strong>{attendanceRate === null ? "—" : `${attendanceRate}%`}</strong><span>attendance ({recorded} days recorded)</span></div>
        <div><strong>{counts.absent ?? 0}</strong><span>days absent</span></div>
        <div><strong>{average === null ? "—" : `${average}%`}</strong><span>average score ({overall.length} results)</span></div>
        <div><strong>{issued.filter((certificate) => !certificate.revokedAt).length}</strong><span>certificates</span></div>
      </div>

      <div className="management-sections">
        <section className="management-card">
          <h2>Attendance by month</h2>
          {monthly.length === 0 ? <p className="empty-state">No attendance recorded yet.</p> : <div className="trend-list">{monthly.map((row) => {
            const rate = percent(Number(row.present), Number(row.total)) ?? 0;
            return (
              <div className="trend-row" key={row.month}>
                <span>{row.month}</span>
                <div className="trend-track"><span style={{ width: `${rate}%` }} /></div>
                <strong>{rate}%</strong>
              </div>
            );
          })}</div>}
        </section>

        <section className="management-card">
          <h2>Results by subject</h2>
          {bySubject.length === 0 ? <p className="empty-state">No results yet.</p> : <div className="trend-list">{bySubject.map((row) => (
            <div className="trend-row" key={row.subject}>
              <span>{row.subject}</span>
              <div className="trend-track"><span style={{ width: `${row.average ?? 0}%` }} /></div>
              <strong>{row.average === null ? "—" : `${row.average}%`}</strong>
            </div>
          ))}</div>}
        </section>

        <section className="management-card">
          <h2>All results</h2>
          {results.length === 0 ? <p className="empty-state">No results yet.</p> : <div className="report-table-wrap"><table className="report-table">
            <thead><tr><th>Date</th><th>Subject</th><th>Assessment</th><th className="numeric">Score</th><th className="numeric">%</th><th>Feedback</th></tr></thead>
            <tbody>{results.map((row, index) => (
              <tr key={index}><td>{row.at.toISOString().slice(0, 10)}</td><td>{row.subject}</td><td>{row.title} <small>({row.kind})</small></td><td className="numeric">{row.score} / {row.maxScore}</td><td className="numeric">{row.percent ?? "—"}</td><td>{row.feedback}</td></tr>
            ))}</tbody>
          </table></div>}
        </section>

        <section className="management-card">
          <h2>My certificates</h2>
          {issued.length === 0 ? <p className="empty-state">No certificates yet.</p> : <div className="record-list">{issued.map((certificate) => (
            <div className="record-row" key={certificate.id}>
              <div><strong>{certificate.name}</strong><small>{certificate.serial} · {certificate.issuedAt.toISOString().slice(0, 10)}{certificate.revokedAt ? " · revoked" : ""}</small></div>
              {!certificate.revokedAt && <Link className="secondary-button record-action" href={`/certificates/print?ids=${certificate.id}`}>View & print</Link>}
            </div>
          ))}</div>}
        </section>

        {shared.some((entry) => entry.fields.length > 0) && (
          <section className="management-card">
            <h2>My school record</h2>
            {shared.map((entry) => entry.fields.length > 0 && (
              <dl className="verify-details" key={entry.record.id}>
                {entry.fields.map((field) => <Fragment key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></Fragment>)}
              </dl>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

export default function MyProgressPage() {
  return <Suspense fallback={<main className="auth-page"><p>Loading your progress...</p></main>}><MyProgressContent /></Suspense>;
}
