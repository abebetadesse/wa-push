import type { Metadata } from "next";
import { and, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db";
import {
  assessmentAttempts,
  assessmentResults,
  assessments,
  attendanceRecords,
  enrollments,
  schoolMemberships,
  students,
} from "@/db/schema";
import { getAccessibleSchools, getSession, isPlatformAdmin } from "@/lib/permissions";

export const metadata: Metadata = { title: "Results & reports | Forma" };

type SearchParams = Promise<{ schoolId?: string }>;

async function ReportsContent({ searchParams }: { searchParams: SearchParams }) {
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
  const schools = accessibleSchools.filter((school) => schoolIds.includes(school.id));
  const params = await searchParams;
  const selectedSchoolId = schoolIds.includes(params.schoolId ?? "") ? params.schoolId! : schoolIds[0];

  const [studentRows, enrollmentRows, attendanceRows, assessmentRows] = await Promise.all([
    db.select({
      id: students.id,
      studentNumber: students.studentNumber,
      firstName: students.firstName,
      lastName: students.lastName,
    }).from(students)
      .where(and(eq(students.schoolId, selectedSchoolId), eq(students.status, "active")))
      .orderBy(students.lastName, students.firstName),
    db.select({
      studentId: enrollments.studentId,
      classroomId: enrollments.classroomId,
      academicYearId: enrollments.academicYearId,
      status: enrollments.status,
    }).from(enrollments)
      .where(and(
        eq(enrollments.schoolId, selectedSchoolId),
        inArray(enrollments.status, ["enrolled", "completed"]),
      )),
    db.select({
      studentId: attendanceRecords.studentId,
      status: attendanceRecords.status,
    }).from(attendanceRecords)
      .where(eq(attendanceRecords.schoolId, selectedSchoolId)),
    db.select({
      id: assessments.id,
      classroomId: assessments.classroomId,
      academicYearId: assessments.academicYearId,
      maxScore: assessments.maxScore,
    }).from(assessments)
      .where(and(
        eq(assessments.schoolId, selectedSchoolId),
        inArray(assessments.status, ["published", "closed"]),
      )),
  ]);

  const assessmentIds = assessmentRows.map(({ id }) => id);
  const [staffMarks, onlineAttempts] = await Promise.all([
    assessmentIds.length
      ? db.select({
        assessmentId: assessmentResults.assessmentId,
        studentId: assessmentResults.studentId,
        score: assessmentResults.score,
      }).from(assessmentResults)
        .where(and(
          eq(assessmentResults.schoolId, selectedSchoolId),
          inArray(assessmentResults.assessmentId, assessmentIds),
        ))
      : Promise.resolve([]),
    assessmentIds.length
      ? db.select({
        assessmentId: assessmentAttempts.assessmentId,
        studentId: assessmentAttempts.studentId,
        score: assessmentAttempts.score,
        maxScore: assessmentAttempts.maxScore,
      }).from(assessmentAttempts)
        .where(and(
          eq(assessmentAttempts.schoolId, selectedSchoolId),
          inArray(assessmentAttempts.assessmentId, assessmentIds),
        ))
      : Promise.resolve([]),
  ]);

  const manualScoreByKey = new Map(staffMarks.map((mark) => [`${mark.assessmentId}:${mark.studentId}`, mark.score]));
  const onlineScoreByKey = new Map(onlineAttempts.map((attempt) => [
    `${attempt.assessmentId}:${attempt.studentId}`,
    { score: attempt.score, maxScore: attempt.maxScore },
  ]));
  const enrollmentKeys = new Set(enrollmentRows.map((enrollment) =>
    `${enrollment.studentId}:${enrollment.classroomId}:${enrollment.academicYearId}`,
  ));
  const attendanceByStudent = new Map<string, { present: number; late: number; absent: number; excused: number; total: number }>();
  for (const record of attendanceRows) {
    const counts = attendanceByStudent.get(record.studentId) ?? { present: 0, late: 0, absent: 0, excused: 0, total: 0 };
    counts[record.status] += 1;
    counts.total += 1;
    attendanceByStudent.set(record.studentId, counts);
  }
  const assessmentsByStudent = new Map<string, { score: number; maxScore: number; count: number }>();
  for (const assessment of assessmentRows) {
    for (const student of studentRows) {
      if (!enrollmentKeys.has(`${student.id}:${assessment.classroomId}:${assessment.academicYearId}`)) continue;
      const key = `${assessment.id}:${student.id}`;
      const manualScore = manualScoreByKey.get(key);
      const attempt = onlineScoreByKey.get(key);
      const score = manualScore ?? attempt?.score;
      const maxScore = attempt?.maxScore ?? assessment.maxScore;
      if (score === undefined || maxScore <= 0) continue;
      const totals = assessmentsByStudent.get(student.id) ?? { score: 0, maxScore: 0, count: 0 };
      totals.score += score;
      totals.maxScore += maxScore;
      totals.count += 1;
      assessmentsByStudent.set(student.id, totals);
    }
  }

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/" className="management-back">← Dashboard</Link>
          <p className="auth-eyebrow">LEARNING OUTCOMES &amp; REPORTS</p>
          <h1>Results &amp; reports</h1>
          <p className="management-description">Review recorded assessment performance and attendance coverage for active students.</p>
        </div>
      </header>
      <div className="management-sections">
        <section className="management-card">
          <form action="/reports" className="auth-form attendance-filter">
            {schools.length > 1 && <label>School<select defaultValue={selectedSchoolId} name="schoolId">
              {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
            </select></label>}
            {schools.length === 1 && <input name="schoolId" type="hidden" value={selectedSchoolId} />}
            <button className="secondary-button" type="submit">View report</button>
          </form>
        </section>
        <section className="management-card">
          <div className="management-card-heading"><div><h2>Student progress</h2><p>{studentRows.length} active student{studentRows.length === 1 ? "" : "s"} · assessment grades use staff marks when available, otherwise online attempts</p></div></div>
          {studentRows.length === 0
            ? <p className="empty-state">No active students are registered in this school.</p>
            : <div className="report-table-wrap"><table className="report-table">
              <thead><tr><th>Student</th><th>Assessment average</th><th>Assessments</th><th>Attendance</th><th>Present</th><th>Absent</th><th>Late</th><th>Excused</th></tr></thead>
              <tbody>{studentRows.map((student) => {
                const grades = assessmentsByStudent.get(student.id);
                const attendance = attendanceByStudent.get(student.id) ?? { present: 0, late: 0, absent: 0, excused: 0, total: 0 };
                const average = grades && grades.maxScore > 0 ? `${Math.round((grades.score / grades.maxScore) * 100)}%` : "—";
                const presentRate = attendance.total > 0
                  ? `${Math.round(((attendance.present + attendance.late) / attendance.total) * 100)}%`
                  : "—";
                return <tr key={student.id}>
                  <td><strong>{student.firstName} {student.lastName}</strong><small>{student.studentNumber}</small></td>
                  <td>{average}</td>
                  <td>{grades?.count ?? 0}</td>
                  <td>{presentRate}<small>{attendance.total} recorded days</small></td>
                  <td>{attendance.present}</td><td>{attendance.absent}</td><td>{attendance.late}</td><td>{attendance.excused}</td>
                </tr>;
              })}</tbody>
            </table></div>}
          <p className="report-note">A formal curriculum-outcome mastery report needs school-specific learning outcomes linked to assessments; these percentages summarize recorded assessments and attendance only.</p>
        </section>
      </div>
    </main>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<main className="auth-page"><p>Loading reports...</p></main>}><ReportsContent searchParams={searchParams} /></Suspense>;
}
