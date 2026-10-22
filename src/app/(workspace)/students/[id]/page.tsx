import type { Metadata } from "next";
import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db";
import { academicYears, classrooms, enrollments, gradeLevels, schools, students } from "@/db/schema";
import { hasSchoolRole, pageRoles, requireWorkspaceContext } from "@/lib/workspace";
import { StudentEditForm } from "./student-edit-form";

export const metadata: Metadata = { title: "Edit student | Forma" };

async function StudentDetail({ studentId }: { studentId: string }) {
  const context = await requireWorkspaceContext();

  const [student] = await db
    .select({
      id: students.id,
      schoolId: students.schoolId,
      schoolName: schools.name,
      schoolStatus: schools.status,
      studentNumber: students.studentNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      email: students.email,
      dateOfBirth: students.dateOfBirth,
      status: students.status,
      userId: students.userId,
    })
    .from(students)
    .innerJoin(schools, eq(students.schoolId, schools.id))
    .where(eq(students.id, studentId))
    .limit(1);
  if (!student || student.schoolStatus === "suspended") notFound();

  if (!hasSchoolRole(context, student.schoolId, pageRoles.schoolAdmin)) notFound();

  const [currentYear] = await db
    .select({ id: academicYears.id, name: academicYears.name })
    .from(academicYears)
    .where(and(eq(academicYears.schoolId, student.schoolId), eq(academicYears.isCurrent, true)))
    .limit(1);
  const [currentClassrooms, history] = await Promise.all([
    currentYear
      ? db.select({ id: classrooms.id, name: classrooms.name, gradeName: gradeLevels.name })
        .from(classrooms)
        .innerJoin(gradeLevels, eq(classrooms.gradeLevelId, gradeLevels.id))
        .where(and(eq(classrooms.schoolId, student.schoolId), eq(classrooms.academicYearId, currentYear.id)))
        .orderBy(gradeLevels.sortOrder, classrooms.name)
      : Promise.resolve([]),
    db.select({
      id: enrollments.id,
      academicYearId: enrollments.academicYearId,
      yearName: academicYears.name,
      classroomId: enrollments.classroomId,
      classroomName: classrooms.name,
      gradeName: gradeLevels.name,
      status: enrollments.status,
    })
      .from(enrollments)
      .innerJoin(academicYears, eq(enrollments.academicYearId, academicYears.id))
      .innerJoin(classrooms, eq(enrollments.classroomId, classrooms.id))
      .innerJoin(gradeLevels, eq(classrooms.gradeLevelId, gradeLevels.id))
      .where(and(eq(enrollments.studentId, student.id), eq(enrollments.schoolId, student.schoolId)))
      .orderBy(desc(academicYears.startsOn)),
  ]);
  const currentEnrollment = history.find((row) => row.academicYearId === currentYear?.id && row.status === "enrolled");

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/students" className="management-back">← Students</Link>
          <p className="auth-eyebrow">{student.schoolName.toUpperCase()}</p>
          <h1>{student.firstName} {student.lastName}</h1>
          <p className="management-description">
            {student.studentNumber}{currentYear ? ` · ${currentYear.name}: ${currentEnrollment ? `${currentEnrollment.gradeName} ${currentEnrollment.classroomName}` : "not enrolled"}` : ""}
            {student.userId ? " · Linked to a student account" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <Link className="secondary-button" href={`/students/${student.id}/report-card`} style={{ display: "inline-flex", alignItems: "center" }}>
            View report card
          </Link>
          <span className={`role-badge status-${student.status}`}>{student.status}</span>
        </div>
      </header>
      <div className="management-sections">
        <section className="management-card">
          <h2>Edit student record</h2>
          {student.userId && <p className="setup-hint">This record is linked to a sign-in account. Changing the email here does not change the account&apos;s sign-in email.</p>}
          <StudentEditForm
            student={{ ...student, classroomId: currentEnrollment?.classroomId ?? null }}
            classrooms={currentClassrooms}
            hasCurrentYear={Boolean(currentYear)}
          />
        </section>
        <section className="management-card">
          <div className="management-card-heading"><div><h2>Enrollment history</h2><p>{history.length} academic year{history.length === 1 ? "" : "s"}</p></div></div>
          {history.length === 0
            ? <p className="empty-state">This student has not been enrolled in a classroom.</p>
            : <div className="record-list">{history.map((row) => (
              <div className="record-row" key={row.id}>
                <div><strong>{row.yearName}</strong><small>{row.gradeName} {row.classroomName}</small></div>
                <span className={`role-badge ${row.status === "enrolled" ? "status-active" : "status-inactive"}`}>{row.status}</span>
              </div>
            ))}</div>}
        </section>
      </div>
    </main>
  );
}

async function StudentDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StudentDetail studentId={id} />;
}

export default function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main className="auth-page"><p>Loading student record...</p></main>}>
      <StudentDetailRoute params={params} />
    </Suspense>
  );
}
