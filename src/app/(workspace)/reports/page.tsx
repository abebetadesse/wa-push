import type { Metadata } from "next";
import { and, desc, eq, inArray } from "drizzle-orm";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import {
  academicYears,
  assessmentAttempts,
  assessmentResults,
  assessments,
  attendanceRecords,
  authUsers,
  classrooms,
  enrollments,
  gradeLevels,
  lessonPlans,
  students,
  subjects,
  teachers,
  teacherReports,
} from "@/db/schema";
import { pageRoles, requireSchoolsFor } from "@/lib/workspace";
import { CsvDownloadButton } from "@/components/csv-download-button";
import { activeTab, PageTabs } from "@/components/page-tabs";
import { CameraReportSubmitter } from "@/components/camera-report-submitter";
import { PhotoReportsList, type SerializedTeacherReport } from "@/components/photo-reports-list";
import { SavedReportFilters } from "./saved-report-filters";
import { ProgressTable } from "./progress-table";

export const metadata: Metadata = { title: "Results & reports | Forma" };

type SearchParams = Promise<{ schoolId?: string; academicYearId?: string; classroomId?: string; subjectId?: string; tab?: string }>;

async function ReportsContent({ searchParams }: { searchParams: SearchParams }) {
  const { context, schoolIds, schools, hasRole } = await requireSchoolsFor(pageRoles.academics);
  const params = await searchParams;
  const selectedSchoolId = schoolIds.includes(params.schoolId ?? "") ? params.schoolId! : schoolIds[0];
  const tab = activeTab(params.tab, ["progress", "camera-reports"] as const);
  const isAdmin = hasRole(selectedSchoolId, "school_admin");

  const [
    studentRows, enrollmentRows, attendanceRows, assessmentRows,
    yearOptions, classOptions, subjectOptions, lessonPlanOptions,
    photoReportRows,
  ] = await Promise.all([
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
      classroomId: attendanceRecords.classroomId,
      status: attendanceRecords.status,
    }).from(attendanceRecords)
      .where(eq(attendanceRecords.schoolId, selectedSchoolId)),
    db.select({
      id: assessments.id,
      classroomId: assessments.classroomId,
      classroomName: classrooms.name,
      academicYearId: assessments.academicYearId,
      yearName: academicYears.name,
      subjectId: assessments.subjectId,
      subjectName: subjects.name,
      maxScore: assessments.maxScore,
    }).from(assessments)
      .innerJoin(classrooms, eq(classrooms.id, assessments.classroomId))
      .innerJoin(academicYears, eq(academicYears.id, assessments.academicYearId))
      .innerJoin(subjects, eq(subjects.id, assessments.subjectId))
      .where(and(
        eq(assessments.schoolId, selectedSchoolId),
        inArray(assessments.status, ["published", "closed"]),
      )),
    db.select({ id: academicYears.id, name: academicYears.name })
      .from(academicYears)
      .where(eq(academicYears.schoolId, selectedSchoolId))
      .orderBy(academicYears.startsOn),
    db.select({ id: classrooms.id, name: classrooms.name, gradeName: gradeLevels.name, academicYearId: classrooms.academicYearId })
      .from(classrooms)
      .innerJoin(gradeLevels, eq(gradeLevels.id, classrooms.gradeLevelId))
      .where(eq(classrooms.schoolId, selectedSchoolId))
      .orderBy(gradeLevels.sortOrder, classrooms.name),
    db.select({ id: subjects.id, name: subjects.name })
      .from(subjects)
      .where(eq(subjects.schoolId, selectedSchoolId))
      .orderBy(subjects.name),
    db.select({ id: lessonPlans.id, title: lessonPlans.title })
      .from(lessonPlans)
      .where(eq(lessonPlans.schoolId, selectedSchoolId))
      .orderBy(desc(lessonPlans.createdAt))
      .limit(50),
    db.select({
      id: teacherReports.id,
      schoolId: teacherReports.schoolId,
      teacherId: teacherReports.teacherId,
      submittedBy: teacherReports.submittedBy,
      title: teacherReports.title,
      section: teacherReports.section,
      reportDate: teacherReports.reportDate,
      photoStorageKey: teacherReports.photoStorageKey,
      photoFileName: teacherReports.photoFileName,
      photoSizeBytes: teacherReports.photoSizeBytes,
      transcription: teacherReports.transcription,
      transcriptionStatus: teacherReports.transcriptionStatus,
      notes: teacherReports.notes,
      classroomId: teacherReports.classroomId,
      classroomName: classrooms.name,
      subjectId: teacherReports.subjectId,
      subjectName: subjects.name,
      lessonPlanId: teacherReports.lessonPlanId,
      lessonPlanTitle: lessonPlans.title,
      assessmentId: teacherReports.assessmentId,
      assessmentTitle: assessments.title,
      status: teacherReports.status,
      reviewFeedback: teacherReports.reviewFeedback,
      reviewedAt: teacherReports.reviewedAt,
      reviewedBy: teacherReports.reviewedBy,
      createdAt: teacherReports.createdAt,
      submitterName: authUsers.name,
      teacherFirstName: teachers.firstName,
      teacherLastName: teachers.lastName,
    })
      .from(teacherReports)
      .innerJoin(authUsers, eq(authUsers.id, teacherReports.submittedBy))
      .leftJoin(teachers, eq(teachers.id, teacherReports.teacherId))
      .leftJoin(classrooms, eq(classrooms.id, teacherReports.classroomId))
      .leftJoin(subjects, eq(subjects.id, teacherReports.subjectId))
      .leftJoin(lessonPlans, eq(lessonPlans.id, teacherReports.lessonPlanId))
      .leftJoin(assessments, eq(assessments.id, teacherReports.assessmentId))
      .where(eq(teacherReports.schoolId, selectedSchoolId))
      .orderBy(desc(teacherReports.createdAt))
      .limit(100),
  ]);


  const selectedYearId = yearOptions.some(({ id }) => id === params.academicYearId) ? params.academicYearId! : "";
  const selectedClassroomId = classOptions.some(({ id, academicYearId }) =>
    id === params.classroomId && (!selectedYearId || academicYearId === selectedYearId),
  ) ? params.classroomId! : "";
  const selectedSubjectId = subjectOptions.some(({ id }) => id === params.subjectId) ? params.subjectId! : "";
  const visibleStudents = studentRows.filter((student) =>
    (!selectedClassroomId && !selectedYearId) || enrollmentRows.some((enrollment) =>
      enrollment.studentId === student.id &&
      (!selectedClassroomId || enrollment.classroomId === selectedClassroomId) &&
      (!selectedYearId || enrollment.academicYearId === selectedYearId),
    ),
  );
  const visibleAssessments = assessmentRows.filter((assessment) =>
    (!selectedClassroomId || assessment.classroomId === selectedClassroomId) &&
    (!selectedYearId || assessment.academicYearId === selectedYearId) &&
    (!selectedSubjectId || assessment.subjectId === selectedSubjectId),
  );
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
  const visibleStudentIds = new Set(visibleStudents.map(({ id }) => id));
  const attendanceClassIds = selectedYearId
    ? new Set(enrollmentRows.filter((enrollment) => enrollment.academicYearId === selectedYearId).map((enrollment) => enrollment.classroomId))
    : null;
  const filteredAttendanceRows = attendanceRows.filter((record) =>
    visibleStudentIds.has(record.studentId) &&
    (!selectedClassroomId || record.classroomId === selectedClassroomId) &&
    (!attendanceClassIds || attendanceClassIds.has(record.classroomId)),
  );
  const attendanceByStudent = new Map<string, { present: number; late: number; absent: number; excused: number; total: number }>();
  for (const record of filteredAttendanceRows) {
    const counts = attendanceByStudent.get(record.studentId) ?? { present: 0, late: 0, absent: 0, excused: 0, total: 0 };
    counts[record.status] += 1;
    counts.total += 1;
    attendanceByStudent.set(record.studentId, counts);
  }
  const assessmentsByStudent = new Map<string, { score: number; maxScore: number; count: number }>();
  for (const assessment of visibleAssessments) {
    for (const student of visibleStudents) {
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

  const trendByYear = new Map<string, { name: string; total: number; count: number }>();
  const comparison = new Map<string, { classroomName: string; subjectName: string; total: number; count: number }>();
  for (const assessment of assessmentRows) {
    const includedForTrend =
      (!selectedClassroomId || assessment.classroomId === selectedClassroomId) &&
      (!selectedSubjectId || assessment.subjectId === selectedSubjectId);
    for (const student of studentRows) {
      if (!enrollmentKeys.has(`${student.id}:${assessment.classroomId}:${assessment.academicYearId}`)) continue;
      const key = `${assessment.id}:${student.id}`;
      const score = manualScoreByKey.get(key) ?? onlineScoreByKey.get(key)?.score;
      const maxScore = onlineScoreByKey.get(key)?.maxScore ?? assessment.maxScore;
      if (score === undefined || maxScore <= 0) continue;
      const percentage = (score / maxScore) * 100;
      if (includedForTrend) {
        const trend = trendByYear.get(assessment.academicYearId) ?? { name: assessment.yearName, total: 0, count: 0 };
        trend.total += percentage;
        trend.count += 1;
        trendByYear.set(assessment.academicYearId, trend);
      }
      if (visibleAssessments.some(({ id }) => id === assessment.id) && visibleStudentIds.has(student.id)) {
        const groupKey = `${assessment.classroomId}:${assessment.subjectId}`;
        const group = comparison.get(groupKey) ?? {
          classroomName: assessment.classroomName,
          subjectName: assessment.subjectName,
          total: 0,
          count: 0,
        };
        group.total += percentage;
        group.count += 1;
        comparison.set(groupKey, group);
      }
    }
  }

  const serializedReports: SerializedTeacherReport[] = photoReportRows.map((r) => ({
    id: r.id,
    schoolId: r.schoolId,
    teacherId: r.teacherId,
    teacherName: r.teacherFirstName ? `${r.teacherFirstName} ${r.teacherLastName}` : "",
    submittedByName: r.submitterName,
    isOwnReport: r.submittedBy === context.userId,
    isAdmin,
    title: r.title,
    section: r.section,
    reportDate: r.reportDate,
    photoUrl: `/api/teacher-reports/${r.id}/photo`,
    photoFileName: r.photoFileName,
    photoSizeBytes: r.photoSizeBytes,
    transcription: r.transcription,
    transcriptionStatus: r.transcriptionStatus,
    notes: r.notes,
    classroomName: r.classroomName,
    subjectName: r.subjectName,
    lessonPlanTitle: r.lessonPlanTitle,
    assessmentTitle: r.assessmentTitle,
    status: r.status,
    reviewedByName: null,
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString().slice(0, 10) : null,
    reviewFeedback: r.reviewFeedback,
    createdAt: r.createdAt.toISOString(),
  }));

  const filterQuery = new URLSearchParams({
    schoolId: selectedSchoolId,
    ...(selectedYearId ? { academicYearId: selectedYearId } : {}),
    ...(selectedClassroomId ? { classroomId: selectedClassroomId } : {}),
    ...(selectedSubjectId ? { subjectId: selectedSubjectId } : {}),
    ...(tab !== "progress" ? { tab } : {}),
  }).toString();

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/" className="management-back">← Dashboard</Link>
          <p className="auth-eyebrow">LEARNING OUTCOMES &amp; REPORTS</p>
          <h1>Results &amp; reports</h1>
          <p className="management-description">Review student assessment outcomes, attendance metrics, and direct camera photo submissions from teachers.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <CameraReportSubmitter
            schools={schools}
            currentSchoolId={selectedSchoolId}
            classrooms={classOptions}
            subjects={subjectOptions}
            lessonPlans={lessonPlanOptions}
            assessments={assessmentRows.map((a) => ({ id: a.id, title: a.subjectName, classroomName: a.classroomName }))}
            triggerButtonText="📷 Submit Photo Report"
          />
        </div>
      </header>

      <PageTabs
        active={tab}
        basePath="/reports"
        params={{ schoolId: selectedSchoolId, academicYearId: selectedYearId, classroomId: selectedClassroomId, subjectId: selectedSubjectId }}
        tabs={[
          { id: "progress", label: "Student Progress & Analytics" },
          { id: "camera-reports", label: "Teacher Photo Reports & Transcriptions", count: photoReportRows.length },
        ]}
      />

      <div className="management-sections">
        {tab === "camera-reports" ? (
          <section className="management-card">
            <div className="management-card-heading">
              <div>
                <h2>Teacher Camera &amp; Field Reports</h2>
                <p>{photoReportRows.length} report photo{photoReportRows.length === 1 ? "" : "s"} submitted across academic sections · Click any report to inspect high-resolution photo and AI transcription</p>
              </div>
              <CameraReportSubmitter
                schools={schools}
                currentSchoolId={selectedSchoolId}
                classrooms={classOptions}
                subjects={subjectOptions}
                lessonPlans={lessonPlanOptions}
                assessments={assessmentRows.map((a) => ({ id: a.id, title: a.subjectName, classroomName: a.classroomName }))}
                triggerButtonText="＋ Capture New Report"
              />
            </div>
            <PhotoReportsList
              reports={serializedReports}
              schoolId={selectedSchoolId}
              isAdmin={isAdmin}
            />
          </section>
        ) : (
          <>
        <section className="management-card">
          <Form action="/reports" className="auth-form attendance-filter">
            {schools.length > 1 && <label>School<select defaultValue={selectedSchoolId} name="schoolId">
              {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
            </select></label>}
            {schools.length === 1 && <input name="schoolId" type="hidden" value={selectedSchoolId} />}
            <label>Academic year<select defaultValue={selectedYearId} name="academicYearId">
              <option value="">All years</option>
              {yearOptions.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
            </select></label>
            <label>Class<select defaultValue={selectedClassroomId} name="classroomId">
              <option value="">All classes</option>
              {classOptions.filter((room) => !selectedYearId || room.academicYearId === selectedYearId).map((room) =>
                <option key={room.id} value={room.id}>{room.gradeName} {room.name}</option>,
              )}
            </select></label>
            <label>Subject<select defaultValue={selectedSubjectId} name="subjectId">
              <option value="">All subjects</option>
              {subjectOptions.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
            </select></label>
            <button className="secondary-button" type="submit">View report</button>
          </Form>
          <SavedReportFilters query={`?${filterQuery}`} />
        </section>
        <section className="management-card">
          <div className="management-card-heading">
            <div><h2>Student progress</h2><p>{visibleStudents.length} active student{visibleStudents.length === 1 ? "" : "s"} · assessment grades use staff marks when available, otherwise online attempts</p></div>
            {visibleStudents.length > 0 && <CsvDownloadButton
              filename="student-progress.csv"
              headers={["Student", "Student number", "Assessment average", "Assessments", "Attendance rate", "Recorded days", "Present", "Absent", "Late", "Excused"]}
              rows={visibleStudents.map((student) => {
                const grades = assessmentsByStudent.get(student.id);
                const attendance = attendanceByStudent.get(student.id) ?? { present: 0, late: 0, absent: 0, excused: 0, total: 0 };
                return [
                  `${student.firstName} ${student.lastName}`,
                  student.studentNumber,
                  grades && grades.maxScore > 0 ? `${Math.round((grades.score / grades.maxScore) * 100)}%` : "",
                  grades?.count ?? 0,
                  attendance.total > 0 ? `${Math.round(((attendance.present + attendance.late) / attendance.total) * 100)}%` : "",
                  attendance.total,
                  attendance.present,
                  attendance.absent,
                  attendance.late,
                  attendance.excused,
                ];
              })}
            />}
          </div>
          {visibleStudents.length === 0
            ? <p className="empty-state">No active students are registered in this school.</p>
            : <ProgressTable rows={visibleStudents.map((student) => {
                const grades = assessmentsByStudent.get(student.id);
                const attendance = attendanceByStudent.get(student.id) ?? { present: 0, late: 0, absent: 0, excused: 0, total: 0 };
                const average = grades && grades.maxScore > 0 ? `${Math.round((grades.score / grades.maxScore) * 100)}%` : "—";
                const presentRate = attendance.total > 0
                  ? `${Math.round(((attendance.present + attendance.late) / attendance.total) * 100)}%`
                  : "—";
                return {
                  id: student.id,
                  name: `${student.firstName} ${student.lastName}`,
                  studentNumber: student.studentNumber,
                  average,
                  assessments: grades?.count ?? 0,
                  attendance: presentRate,
                  recordedDays: attendance.total,
                  present: attendance.present,
                  absent: attendance.absent,
                  late: attendance.late,
                  excused: attendance.excused,
                };
              })} />}
          <p className="report-note">A formal curriculum-outcome mastery report needs school-specific learning outcomes linked to assessments; these percentages summarize recorded assessments and attendance only.</p>
        </section>
        <section className="management-card">
          <div className="management-card-heading"><div><h2>Academic trends</h2><p>Average percentage across recorded assessment attempts and staff marks, by academic year</p></div></div>
          {trendByYear.size === 0 ? <p className="empty-state">No assessment results are available for a year-over-year trend.</p> : <div className="trend-list">
            {yearOptions.filter((year) => trendByYear.has(year.id)).map((year) => {
              const trend = trendByYear.get(year.id)!;
              const average = Math.round(trend.total / trend.count);
              return <div className="trend-row" key={year.id}>
                <strong>{year.name}</strong><div className="trend-track"><span style={{ width: `${Math.min(average, 100)}%` }} /></div>
                <span>{average}% · {trend.count} results</span>
              </div>;
            })}
          </div>}
        </section>
        <section className="management-card">
          <div className="management-card-heading"><div><h2>Class and subject comparison</h2><p>Mean scored percentage for the selected filters</p></div></div>
          {comparison.size === 0 ? <p className="empty-state">No graded assessments match these filters.</p> : <div className="report-table-wrap">
            <table className="report-table"><thead><tr><th>Class</th><th>Subject</th><th>Mean percentage</th><th>Results counted</th></tr></thead>
              <tbody>{[...comparison.values()].sort((a, b) => a.classroomName.localeCompare(b.classroomName) || a.subjectName.localeCompare(b.subjectName)).map((group) => (
                <tr key={`${group.classroomName}:${group.subjectName}`}><td>{group.classroomName}</td><td>{group.subjectName}</td><td>{Math.round(group.total / group.count)}%</td><td>{group.count}</td></tr>
              ))}</tbody>
            </table>
          </div>}
        </section>
        </>
        )}
      </div>
    </main>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<main className="auth-page"><p>Loading reports...</p></main>}><ReportsContent searchParams={searchParams} /></Suspense>;
}
