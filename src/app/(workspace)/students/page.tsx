import { ActionForm } from "@/components/action-form";
import type { Metadata } from "next";
import { and, eq, inArray } from "drizzle-orm";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { academicYears, classrooms, enrollments, gradeLevels, schools, students } from "@/db/schema";
import { ListSearch } from "@/components/list-search";
import { CsvDownloadButton } from "@/components/csv-download-button";
import { PageSkeleton } from "@/components/page-skeleton";
import { SubmitButton } from "@/components/submit-button";
import { pageRoles, requireSchoolsFor } from "@/lib/workspace";
import { changeStudentStatus } from "./actions";
import { BulkStudentImportForm } from "./bulk-import-form";
import { StudentForm } from "./student-form";

export const metadata: Metadata = { title: "Students | Forma" };

type SearchParams = Promise<{ schoolId?: string; classroomId?: string; status?: string }>;

async function StudentsContent({ searchParams }: { searchParams: SearchParams }) {
  const { context, schoolIds, schools: visibleSchools, hasRole } = await requireSchoolsFor(pageRoles.academics);
  const params = await searchParams;
  const selectedSchoolId = schoolIds.includes(params.schoolId ?? "") ? params.schoolId! : schoolIds[0];
  const selectedStatus = ["active", "inactive", "graduated", "transferred"].includes(params.status ?? "")
    ? params.status!
    : "";
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
      guardianEmail: students.guardianEmail,
      status: students.status,
    })
    .from(students)
    .innerJoin(schools, eq(students.schoolId, schools.id))
    .where(and(
      eq(students.schoolId, selectedSchoolId),
      selectedStatus ? eq(students.status, selectedStatus as "active" | "inactive" | "graduated" | "transferred") : undefined,
    ))
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
      .where(eq(classrooms.schoolId, selectedSchoolId))
      .orderBy(gradeLevels.sortOrder, classrooms.name),
  ]);
  const selectedClassroomId = currentClassrooms.some(({ id }) => id === params.classroomId) ? params.classroomId! : "";
  const enrolledIds = selectedClassroomId
    ? await db.select({ studentId: enrollments.studentId })
      .from(enrollments)
      .where(and(
        eq(enrollments.schoolId, selectedSchoolId),
        eq(enrollments.classroomId, selectedClassroomId),
        inArray(enrollments.status, ["enrolled", "completed"]),
      ))
    : null;
  const visibleStudents = enrolledIds
    ? studentRows.filter((student) => enrolledIds.some(({ studentId }) => studentId === student.id))
    : studentRows;
  const canRegister = context.platformAdmin || context.roles.some(({ role }) => role === "school_admin");

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
          <Form action="/students" className="auth-form attendance-filter">
            {visibleSchools.length > 1 && <label>School<select defaultValue={selectedSchoolId} name="schoolId">
              {visibleSchools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
            </select></label>}
            {visibleSchools.length === 1 && <input name="schoolId" type="hidden" value={selectedSchoolId} />}
            <label>Class<select defaultValue={selectedClassroomId} name="classroomId">
              <option value="">All current classes</option>
              {currentClassrooms.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.gradeName} {classroom.name}</option>)}
            </select></label>
            <label>Status<select defaultValue={selectedStatus} name="status">
              <option value="">All statuses</option>
              <option value="active">Active</option><option value="inactive">Inactive</option>
              <option value="graduated">Graduated</option><option value="transferred">Transferred</option>
            </select></label>
            <button className="secondary-button" type="submit">Apply filters</button>
          </Form>
        </section>
        <section className="management-card">
          <div className="management-card-heading">
            <div><h2>Student roster</h2><p>{visibleStudents.length} student{visibleStudents.length === 1 ? "" : "s"} shown</p></div>
            <div className="inline-actions">
              {visibleStudents.length > 0 && <CsvDownloadButton
                filename="students.csv"
                headers={["School", "Student number", "First name", "Last name", "Student email", "Guardian email", "Status"]}
                filterTargetId="student-roster"
                rows={visibleStudents.map((student) => [
                  student.schoolName,
                  student.studentNumber,
                  student.firstName,
                  student.lastName,
                  student.email,
                  student.guardianEmail,
                  student.status,
                ])}
              />}
              {visibleStudents.length > 5 && <ListSearch targetId="student-roster" label="Search students" placeholder="Search by name, number, email…" />}
            </div>
          </div>
          {visibleStudents.length === 0 ? <p className="empty-state">No students match these filters{canRegister ? " yet. Use the form above or import a CSV to add students." : "."}</p> : <div className="record-list" id="student-roster">
            {visibleStudents.map((student) => {
              const canManage = hasRole(student.schoolId, "school_admin");
              return (
                <div className="record-row student-record" key={student.id}>
                  <div>
                    <strong>{canManage ? <Link className="text-link" href={`/students/${student.id}`}>{student.firstName} {student.lastName}</Link> : `${student.firstName} ${student.lastName}`}</strong>
                    <small>{student.studentNumber} · {student.schoolName}{student.email ? ` · ${student.email}` : ""}{student.guardianEmail ? ` · Guardian: ${student.guardianEmail}` : ""}</small>
                  </div>
                  <span className={`role-badge status-${student.status}`}>{student.status.replaceAll("_", " ")}</span>
                  <Link className="secondary-button record-action" href={`/students/${student.id}/report-card`}>Report card</Link>
                  {canManage && (
                    <ActionForm action={changeStudentStatus}>
                      <input name="schoolId" type="hidden" value={student.schoolId} />
                      <input name="studentId" type="hidden" value={student.id} />
                      <input name="status" type="hidden" value={student.status === "active" ? "inactive" : "active"} />
                      <SubmitButton
                        confirm={student.status === "active" ? `Deactivate ${student.firstName} ${student.lastName}? You can reactivate them at any time.` : undefined}
                        pendingLabel={student.status === "active" ? "Deactivating…" : "Activating…"}
                      >
                        {student.status === "active" ? "Deactivate" : "Activate"}
                      </SubmitButton>
                    </ActionForm>
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

export default function StudentsPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<PageSkeleton />}><StudentsContent searchParams={searchParams} /></Suspense>;
}
