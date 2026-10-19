import type { Metadata } from "next";
import { and, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db";
import {
  academicYears,
  assessmentAttempts,
  assessmentResults,
  assessments,
  attendanceRecords,
  classrooms,
  enrollments,
  gradeLevels,
  schoolMemberships,
  schools,
  students,
  subjects,
} from "@/db/schema";
import { getSession, isPlatformAdmin } from "@/lib/permissions";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Student Report Card | Forma" };

function getLetterGrade(percentage: number): { letter: string; gpa: number; remark: string } {
  if (percentage >= 90) return { letter: "A", gpa: 4.0, remark: "Outstanding" };
  if (percentage >= 80) return { letter: "B", gpa: 3.0, remark: "Very Good" };
  if (percentage >= 70) return { letter: "C", gpa: 2.0, remark: "Good" };
  if (percentage >= 60) return { letter: "D", gpa: 1.0, remark: "Satisfactory" };
  return { letter: "F", gpa: 0.0, remark: "Needs Improvement" };
}

async function ReportCardContent({ studentId }: { studentId: string }) {
  const session = await getSession();
  if (!session) redirect("/login");

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

  // Permission check
  const platformAdmin = isPlatformAdmin(session);
  const isOwnRecord = student.userId === session.user.id;
  if (!platformAdmin && !isOwnRecord) {
    const [membership] = await db
      .select({ role: schoolMemberships.role })
      .from(schoolMemberships)
      .where(and(eq(schoolMemberships.schoolId, student.schoolId), eq(schoolMemberships.userId, session.user.id)))
      .limit(1);
    if (!membership || !["school_admin", "teacher"].includes(membership.role)) {
      notFound();
    }
  }

  // Current academic year & enrollment
  const [currentYear] = await db
    .select({ id: academicYears.id, name: academicYears.name, startsOn: academicYears.startsOn, endsOn: academicYears.endsOn })
    .from(academicYears)
    .where(and(eq(academicYears.schoolId, student.schoolId), eq(academicYears.isCurrent, true)))
    .limit(1);

  const [enrollment] = currentYear
    ? await db
      .select({
        id: enrollments.id,
        classroomId: classrooms.id,
        classroomName: classrooms.name,
        gradeName: gradeLevels.name,
        status: enrollments.status,
      })
      .from(enrollments)
      .innerJoin(classrooms, eq(enrollments.classroomId, classrooms.id))
      .innerJoin(gradeLevels, eq(classrooms.gradeLevelId, gradeLevels.id))
      .where(and(
        eq(enrollments.studentId, student.id),
        eq(enrollments.academicYearId, currentYear.id),
        eq(enrollments.status, "enrolled"),
      ))
      .limit(1)
    : [];

  // Attendance
  const attendanceRows = await db
    .select({
      status: attendanceRecords.status,
      date: attendanceRecords.date,
    })
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.studentId, student.id), eq(attendanceRecords.schoolId, student.schoolId)));

  const attendance = { present: 0, late: 0, absent: 0, excused: 0, total: 0 };
  for (const row of attendanceRows) {
    attendance[row.status] += 1;
    attendance.total += 1;
  }
  const attendanceRate = attendance.total > 0
    ? Math.round(((attendance.present + attendance.late) / attendance.total) * 100)
    : null;

  // Assessments for the student's classroom
  const assessmentList = enrollment
    ? await db
      .select({
        id: assessments.id,
        title: assessments.title,
        maxScore: assessments.maxScore,
        subjectId: assessments.subjectId,
        subjectName: subjects.name,
        subjectCode: subjects.code,
      })
      .from(assessments)
      .innerJoin(subjects, eq(assessments.subjectId, subjects.id))
      .where(and(
        eq(assessments.schoolId, student.schoolId),
        eq(assessments.classroomId, enrollment.classroomId),
        eq(assessments.academicYearId, currentYear!.id),
        inArray(assessments.status, ["published", "closed"]),
      ))
      .orderBy(subjects.name, assessments.title)
    : [];

  const assessmentIds = assessmentList.map((a) => a.id);
  const [marks, attempts] = await Promise.all([
    assessmentIds.length
      ? db
        .select({
          assessmentId: assessmentResults.assessmentId,
          score: assessmentResults.score,
          feedback: assessmentResults.feedback,
        })
        .from(assessmentResults)
        .where(and(
          eq(assessmentResults.schoolId, student.schoolId),
          eq(assessmentResults.studentId, student.id),
          inArray(assessmentResults.assessmentId, assessmentIds),
        ))
      : Promise.resolve([]),
    assessmentIds.length
      ? db
        .select({
          assessmentId: assessmentAttempts.assessmentId,
          score: assessmentAttempts.score,
          maxScore: assessmentAttempts.maxScore,
        })
        .from(assessmentAttempts)
        .where(and(
          eq(assessmentAttempts.schoolId, student.schoolId),
          eq(assessmentAttempts.studentId, student.id),
          inArray(assessmentAttempts.assessmentId, assessmentIds),
        ))
      : Promise.resolve([]),
  ]);

  const markMap = new Map(marks.map((m) => [m.assessmentId, m]));
  const attemptMap = new Map(attempts.map((a) => [a.assessmentId, a]));

  // Group assessments by Subject
  type SubjectSummary = {
    subjectName: string;
    subjectCode: string | null;
    items: Array<{
      title: string;
      score: number | null;
      maxScore: number;
      feedback: string | null;
    }>;
    totalScore: number;
    totalMax: number;
  };

  const subjectMap = new Map<string, SubjectSummary>();
  for (const a of assessmentList) {
    const mark = markMap.get(a.id);
    const attempt = attemptMap.get(a.id);
    const score = mark?.score ?? attempt?.score ?? null;
    const maxScore = attempt?.maxScore ?? a.maxScore;
    const feedback = mark?.feedback ?? null;

    let sub = subjectMap.get(a.subjectName);
    if (!sub) {
      sub = {
        subjectName: a.subjectName,
        subjectCode: a.subjectCode,
        items: [],
        totalScore: 0,
        totalMax: 0,
      };
      subjectMap.set(a.subjectName, sub);
    }
    sub.items.push({ title: a.title, score, maxScore, feedback });
    if (score !== null) {
      sub.totalScore += score;
      sub.totalMax += maxScore;
    }
  }

  const subjectSummaries = Array.from(subjectMap.values());
  let overallEarned = 0;
  let overallPossible = 0;
  for (const s of subjectSummaries) {
    overallEarned += s.totalScore;
    overallPossible += s.totalMax;
  }
  const overallPercentage = overallPossible > 0 ? Math.round((overallEarned / overallPossible) * 100) : null;
  const overallGrade = overallPercentage !== null ? getLetterGrade(overallPercentage) : null;

  const todayFormatted = new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date());

  return (
    <main className="management-page report-card-page">
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .print-hide, .management-back, .management-header, .topbar, .sidebar {
            display: none !important;
          }
          .report-card-container {
            border: 2px solid #0f172a !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 24px !important;
            max-width: 100% !important;
          }
          .report-card-header {
            border-bottom: 2px solid #0f172a !important;
          }
          .report-card-table th {
            background-color: #f1f5f9 !important;
            color: black !important;
          }
        }
        .report-card-container {
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 16px rgba(0,0,0,0.06);
          padding: 32px;
          max-width: 900px;
          margin: 0 auto;
          color: #0f172a;
        }
        .report-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 20px;
          margin-bottom: 24px;
        }
        .school-emblem {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .emblem-icon {
          width: 44px;
          height: 44px;
          background: #2563eb;
          color: white;
          font-weight: 800;
          font-size: 20px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .school-title {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0;
          color: #0f172a;
        }
        .report-badge {
          font-size: 0.85rem;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #64748b;
          margin: 0;
        }
        .student-meta-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          background: #f8fafc;
          border-radius: 8px;
          padding: 16px 20px;
          margin-bottom: 28px;
          font-size: 0.92rem;
        }
        .meta-item strong {
          display: block;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b;
          margin-bottom: 2px;
        }
        .report-section-title {
          font-size: 1.15rem;
          font-weight: 700;
          margin: 24px 0 12px;
          color: #1e293b;
          border-left: 4px solid #2563eb;
          padding-left: 10px;
        }
        .report-card-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 0.9rem;
        }
        .report-card-table th {
          background: #f1f5f9;
          text-align: left;
          padding: 10px 14px;
          font-weight: 600;
          color: #334155;
          border-bottom: 2px solid #cbd5e1;
        }
        .report-card-table td {
          padding: 10px 14px;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: middle;
        }
        .grade-pill {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: 700;
          font-size: 0.85rem;
        }
        .grade-A { background: #dcfce7; color: #166534; }
        .grade-B { background: #dbeafe; color: #1e40af; }
        .grade-C { background: #fef9c3; color: #854d0e; }
        .grade-D { background: #ffedd5; color: #9a3412; }
        .grade-F { background: #fee2e2; color: #991b1b; }
        .summary-banner {
          display: flex;
          justify-content: space-around;
          align-items: center;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 20px;
          margin: 28px 0;
          text-align: center;
        }
        .summary-metric strong {
          display: block;
          font-size: 1.75rem;
          font-weight: 800;
          color: #0f172a;
        }
        .summary-metric span {
          font-size: 0.8rem;
          text-transform: uppercase;
          color: #64748b;
          letter-spacing: 0.05em;
        }
        .signatures-area {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          margin-top: 48px;
          padding-top: 24px;
          border-top: 1px dashed #cbd5e1;
          font-size: 0.85rem;
          color: #475569;
        }
        .signature-line {
          border-bottom: 1px solid #94a3b8;
          height: 36px;
          margin-bottom: 8px;
        }
      `}</style>

      <header className="management-header print-hide">
        <div>
          <Link href={isOwnRecord ? "/my-learning" : `/students/${student.id}`} className="management-back">
            ← Back to Student Record
          </Link>
          <p className="auth-eyebrow">ACADEMIC EVALUATION</p>
          <h1>Official Student Report Card</h1>
          <p className="management-description">
            Academic performance summary for {student.firstName} {student.lastName}.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <PrintButton />
        </div>
      </header>

      <div className="report-card-container">
        {/* Header */}
        <div className="report-card-header">
          <div className="school-emblem">
            <div className="emblem-icon">{student.schoolName.charAt(0)}</div>
            <div>
              <p className="report-badge">Official Academic Report</p>
              <h2 className="school-title">{student.schoolName}</h2>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "0.95rem" }}>
              {currentYear ? currentYear.name : "Academic Year"}
            </p>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>Issued: {todayFormatted}</p>
          </div>
        </div>

        {/* Student Meta */}
        <div className="student-meta-grid">
          <div className="meta-item">
            <strong>Student Name</strong>
            <span>{student.firstName} {student.lastName}</span>
          </div>
          <div className="meta-item">
            <strong>Student ID</strong>
            <span>{student.studentNumber}</span>
          </div>
          <div className="meta-item">
            <strong>Grade / Classroom</strong>
            <span>{enrollment ? `${enrollment.gradeName} - ${enrollment.classroomName}` : "Not Enrolled"}</span>
          </div>
          <div className="meta-item">
            <strong>Student Status</strong>
            <span style={{ textTransform: "capitalize" }}>{student.status}</span>
          </div>
          {student.dateOfBirth && (
            <div className="meta-item">
              <strong>Date of Birth</strong>
              <span>{student.dateOfBirth}</span>
            </div>
          )}
          {student.email && (
            <div className="meta-item">
              <strong>Contact Email</strong>
              <span>{student.email}</span>
            </div>
          )}
        </div>

        {/* Overall Summary Banner */}
        <div className="summary-banner">
          <div className="summary-metric">
            <strong>{overallPercentage !== null ? `${overallPercentage}%` : "—"}</strong>
            <span>Academic Average</span>
          </div>
          <div className="summary-metric">
            <strong style={{ color: "#2563eb" }}>{overallGrade ? overallGrade.letter : "—"}</strong>
            <span>Overall Grade</span>
          </div>
          <div className="summary-metric">
            <strong>{overallGrade ? overallGrade.gpa.toFixed(1) : "—"}</strong>
            <span>GPA (4.0 Scale)</span>
          </div>
          <div className="summary-metric">
            <strong>{attendanceRate !== null ? `${attendanceRate}%` : "—"}</strong>
            <span>Attendance Rate</span>
          </div>
        </div>

        {/* Subject Grades Table */}
        <h3 className="report-section-title">Academic Subject Performance</h3>
        {subjectSummaries.length === 0 ? (
          <p className="empty-state" style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>
            No assessments have been recorded for this student in the current academic year.
          </p>
        ) : (
          <table className="report-card-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Assessment Tasks</th>
                <th>Score Earned</th>
                <th>Max Points</th>
                <th>Percentage</th>
                <th>Grade</th>
                <th>Remark</th>
              </tr>
            </thead>
            <tbody>
              {subjectSummaries.map((sub) => {
                const pct = sub.totalMax > 0 ? Math.round((sub.totalScore / sub.totalMax) * 100) : null;
                const grade = pct !== null ? getLetterGrade(pct) : null;
                return (
                  <tr key={sub.subjectName}>
                    <td>
                      <strong>{sub.subjectName}</strong>
                      {sub.subjectCode && <small style={{ display: "block", color: "#64748b" }}>{sub.subjectCode}</small>}
                    </td>
                    <td>{sub.items.length} assessment{sub.items.length === 1 ? "" : "s"}</td>
                    <td>{sub.totalScore}</td>
                    <td>{sub.totalMax}</td>
                    <td>{pct !== null ? `${pct}%` : "—"}</td>
                    <td>
                      {grade ? (
                        <span className={`grade-pill grade-${grade.letter}`}>{grade.letter}</span>
                      ) : "—"}
                    </td>
                    <td>{grade ? grade.remark : "Pending"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Attendance Breakdown */}
        <h3 className="report-section-title">Attendance &amp; Participation</h3>
        <table className="report-card-table">
          <thead>
            <tr>
              <th>Total Days Recorded</th>
              <th>Present</th>
              <th>Late</th>
              <th>Excused</th>
              <th>Absent</th>
              <th>Overall Attendance</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>{attendance.total} days</strong></td>
              <td>{attendance.present}</td>
              <td>{attendance.late}</td>
              <td>{attendance.excused}</td>
              <td>{attendance.absent}</td>
              <td>
                <strong>
                  {attendanceRate !== null ? `${attendanceRate}%` : "No records"}
                </strong>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Signatures */}
        <div className="signatures-area">
          <div>
            <div className="signature-line" />
            <p><strong>Class Teacher Signature</strong></p>
          </div>
          <div>
            <div className="signature-line" />
            <p><strong>School Principal / Administrator</strong></p>
          </div>
          <div>
            <div className="signature-line" />
            <p><strong>Parent / Guardian Signature</strong></p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ReportCardPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main className="auth-page"><p>Generating report card...</p></main>}>
      {params.then(({ id }) => <ReportCardContent studentId={id} />)}
    </Suspense>
  );
}
