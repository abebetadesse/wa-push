import type { Metadata } from "next";
import { and, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db";
import { academicYears, classrooms, gradeLevels, schoolMemberships, schools, students } from "@/db/schema";
import { ListSearch } from "@/components/list-search";
import { PageSkeleton } from "@/components/page-skeleton";
import { SubmitButton } from "@/components/submit-button";
import { getAccessibleSchools, getSession, isPlatformAdmin } from "@/lib/permissions";
import { changeStudentStatus } from "./actions";
import { BulkStudentImportForm } from "./bulk-import-form";
import { StudentForm } from "./student-form";

export const metadata: Metadata = { title: "Students | Forma" };

async function StudentsContent() {
  const session = await getSession();
  if (!session) redirect("/login");
  const platformAdmin = isPlatformAdmin(session);
  const accessibleSchools = await getAccessibleSchools();
  const roles = platformAdmin
    ? []
    : await db
      .select({ schoolId: schoolMemberships.schoolId, role: schoolMemberships.role })
      .from(schoolMemberships)
      .where(eq(schoolMemberships.userId, session.user.id));
  const allowed = new Set(["school_admin", "teacher"]);
  const schoolIds = platformAdmin
    ? accessibleSchools.map((school) => school.id)
    : roles.filter(({ role }) => allowed.has(role)).map(({ schoolId }) => schoolId);

  if (schoolIds.length === 0) redirect("/no-access");
  const visibleSchools = accessibleSchools.filter((school) => schoolIds.includes(school.id));
  const [studentRows, currentClassrooms] = await Promise.all([
    db
      .select({
      id: students.id,
      schoolId: students.schoolId,
      schoolName: schools.name,
      studentNumber: students.studentNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      email: students.email,
      status: students.status,
    })
    .from(students)
    .innerJoin(schools, eq(students.schoolId, schools.id))
    .where(inArray(students.schoolId, schoolIds))
    .orderBy(students.lastName, students.firstName),
    db
      .select({
        id: classrooms.id,
        schoolId: classrooms.schoolId,
        name: classrooms.name,
        gradeName: gradeLevels.name,
        academicYearName: academicYears.name,
      })
      .from(classrooms)
      .innerJoin(academicYears, and(eq(classrooms.academicYearId, academicYears.id), eq(academicYears.isCurrent, true)))
      .innerJoin(gradeLevels, eq(classrooms.gradeLevelId, gradeLevels.id))
      .where(inArray(classrooms.schoolId, schoolIds))
      .orderBy(gradeLevels.sortOrder, classrooms.name),
  ]);
  const canRegister = platformAdmin || roles.some(({ role }) => role === "school_admin");

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/" className="management-back">← Dashboard</Link>
          <p className="auth-eyebrow">STUDENT INFORMATION</p>
          <h1>Students</h1>
          <p className="management-description">Student records are restricted to your assigned schools.</p>
        </div>
      </header>
      <div className="management-sections">
        {canRegister && (
          <>
            <section className="management-card" id="register">
              <h2>Register a student</h2>
              <StudentForm schools={visibleSchools} classrooms={currentClassrooms} />
            </section>
            <section className="management-card">
              <h2>Bulk import students (CSV)</h2>
              <BulkStudentImportForm schools={visibleSchools} classrooms={currentClassrooms} />
            </section>
          </>
        )}
        <section className="management-card">
          <div className="management-card-heading">
            <div><h2>Student roster</h2><p>{studentRows.length} student{studentRows.length === 1 ? "" : "s"}</p></div>
            {studentRows.length > 5 && <ListSearch targetId="student-roster" label="Search students" placeholder="Search by name, number, email…" />}
          </div>
          {studentRows.length === 0 ? <p className="empty-state">No students have been registered in these schools{canRegister ? " yet. Use the form above or import a CSV to add your first students." : "."}</p> : <div className="record-list" id="student-roster">
            {studentRows.map((student) => {
              const canManage = platformAdmin || roles.some(({ schoolId, role }) => schoolId === student.schoolId && role === "school_admin");
              return (
                <div className="record-row student-record" key={student.id}>
                  <div>
                    <strong>{canManage ? <Link className="text-link" href={`/students/${student.id}`}>{student.firstName} {student.lastName}</Link> : `${student.firstName} ${student.lastName}`}</strong>
                    <small>{student.studentNumber} · {student.schoolName}{student.email ? ` · ${student.email}` : ""}</small>
                  </div>
                  <span className={`role-badge status-${student.status}`}>{student.status.replaceAll("_", " ")}</span>
                  <Link className="secondary-button record-action" href={`/students/${student.id}/report-card`}>Report card</Link>
                  {canManage && (
                    <form action={changeStudentStatus}>
                      <input name="schoolId" type="hidden" value={student.schoolId} />
                      <input name="studentId" type="hidden" value={student.id} />
                      <input name="status" type="hidden" value={student.status === "active" ? "inactive" : "active"} />
                      <SubmitButton
                        confirm={student.status === "active" ? `Deactivate ${student.firstName} ${student.lastName}? You can reactivate them at any time.` : undefined}
                        pendingLabel={student.status === "active" ? "Deactivating…" : "Activating…"}
                      >
                        {student.status === "active" ? "Deactivate" : "Activate"}
                      </SubmitButton>
                    </form>
                  )}
                  {canManage && <Link className="secondary-button record-action" href={`/students/${student.id}`}>Edit</Link>}
                </div>
              );
            })}
          </div>}
        </section>
      </div>
    </main>
  );
}

export default function StudentsPage() {
  return <Suspense fallback={<PageSkeleton />}><StudentsContent /></Suspense>;
}
