import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db";
import {
  academicYears,
  attendanceRecords,
  classrooms,
  enrollments,
  gradeLevels,
  schoolMemberships,
  students,
} from "@/db/schema";
import { getAccessibleSchools, getSession, isPlatformAdmin } from "@/lib/permissions";
import { AttendanceForm, type AttendanceRosterEntry } from "./attendance-form";

export const metadata: Metadata = { title: "Attendance | Forma" };

type SearchParams = Promise<{ schoolId?: string; classroomId?: string; date?: string }>;

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

async function AttendanceContent({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const platformAdmin = isPlatformAdmin(session);
  const accessibleSchools = await getAccessibleSchools();
  const memberships = platformAdmin
    ? []
    : await db.select({ schoolId: schoolMemberships.schoolId, role: schoolMemberships.role })
      .from(schoolMemberships)
      .where(eq(schoolMemberships.userId, session.user.id));
  const schoolIds = platformAdmin
    ? accessibleSchools.map((school) => school.id)
    : memberships.filter(({ role }) => role === "school_admin" || role === "teacher").map(({ schoolId }) => schoolId);
  if (schoolIds.length === 0) redirect("/no-access");
  const visibleSchools = accessibleSchools.filter((school) => schoolIds.includes(school.id));

  const params = await searchParams;
  const selectedSchoolId = schoolIds.includes(params.schoolId ?? "")
    ? params.schoolId!
    : schoolIds[0];
  const date = params.date && isDate(params.date) ? params.date : new Date().toISOString().slice(0, 10);
  const classRows = await db.select({
    id: classrooms.id,
    name: classrooms.name,
    gradeName: gradeLevels.name,
    academicYearId: classrooms.academicYearId,
    yearName: academicYears.name,
  })
    .from(classrooms)
    .innerJoin(academicYears, and(
      eq(academicYears.id, classrooms.academicYearId),
      eq(academicYears.schoolId, classrooms.schoolId),
      eq(academicYears.isCurrent, true),
    ))
    .innerJoin(gradeLevels, and(
      eq(gradeLevels.id, classrooms.gradeLevelId),
      eq(gradeLevels.schoolId, classrooms.schoolId),
    ))
    .where(eq(classrooms.schoolId, selectedSchoolId))
    .orderBy(gradeLevels.sortOrder, classrooms.name);
  const classroomId = classRows.some(({ id }) => id === params.classroomId)
    ? params.classroomId!
    : classRows[0]?.id ?? "";

  const rosterRows = classroomId
    ? await db.select({
      studentId: students.id,
      studentNumber: students.studentNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      status: attendanceRecords.status,
      remarks: attendanceRecords.remarks,
    })
      .from(enrollments)
      .innerJoin(students, and(
        eq(students.id, enrollments.studentId),
        eq(students.schoolId, enrollments.schoolId),
        eq(students.status, "active"),
      ))
      .leftJoin(attendanceRecords, and(
        eq(attendanceRecords.studentId, students.id),
        eq(attendanceRecords.classroomId, enrollments.classroomId),
        eq(attendanceRecords.schoolId, selectedSchoolId),
        eq(attendanceRecords.date, date),
      ))
      .where(and(
        eq(enrollments.schoolId, selectedSchoolId),
        eq(enrollments.classroomId, classroomId),
        eq(enrollments.status, "enrolled"),
      ))
      .orderBy(students.lastName, students.firstName)
    : [];
  const roster: AttendanceRosterEntry[] = rosterRows.map((student) => ({
    studentId: student.studentId,
    studentNumber: student.studentNumber,
    studentName: `${student.firstName} ${student.lastName}`,
    status: student.status ?? "present",
    remarks: student.remarks ?? "",
  }));

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/" className="management-back">← Dashboard</Link>
          <p className="auth-eyebrow">DAILY CLASS RECORDS</p>
          <h1>Attendance</h1>
          <p className="management-description">Record and update attendance for active students in a class.</p>
        </div>
      </header>
      <div className="management-sections">
        <section className="management-card">
          <h2>Select a class and date</h2>
          <Form action="/attendance" className="auth-form attendance-filter">
            {visibleSchools.length > 1 && (
              <label>School
                <select defaultValue={selectedSchoolId} name="schoolId">
                  {visibleSchools.map((school) => (
                    <option key={school.id} value={school.id}>{school.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label>Class
              <select defaultValue={classroomId} name="classroomId" required>
                {classRows.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>{classroom.gradeName} {classroom.name} · {classroom.yearName}</option>
                ))}
              </select>
            </label>
            <label>Date<input defaultValue={date} name="date" required type="date" /></label>
            {visibleSchools.length === 1 && <input name="schoolId" type="hidden" value={selectedSchoolId} />}
            <button className="secondary-button" type="submit">Load roster</button>
          </Form>
        </section>
        <section className="management-card">
          <div className="management-card-heading">
            <div>
              <h2>{classRows.find(({ id }) => id === classroomId)?.gradeName ?? "Class"} {classRows.find(({ id }) => id === classroomId)?.name ?? ""}</h2>
              <p>{roster.length} active student{roster.length === 1 ? "" : "s"} · {date}</p>
            </div>
          </div>
          {classRows.length === 0
            ? <p className="empty-state">
              {platformAdmin || memberships.some(({ schoolId, role }) => schoolId === selectedSchoolId && role === "school_admin")
                ? <>Set up a current academic year and classes in <Link className="text-link" href="/academic-setup">Academic setup</Link> before recording attendance.</>
                : "This school has no classes in its current academic year yet. Ask a school administrator to set them up before recording attendance."}
            </p>
            : roster.length === 0
              ? <p className="empty-state">No active students are enrolled in this class.</p>
              : <AttendanceForm schoolId={selectedSchoolId} classroomId={classroomId} date={date} roster={roster} />}
        </section>
      </div>
    </main>
  );
}

export default async function AttendancePage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<main className="auth-page"><p>Loading attendance...</p></main>}><AttendanceContent searchParams={searchParams} /></Suspense>;
}
