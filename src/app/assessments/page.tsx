import type { Metadata } from "next";
import { and, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db";
import {
  academicYears,
  assessmentAttempts,
  assessmentQuestions,
  assessmentResults,
  assessments,
  authUsers,
  classrooms,
  enrollments,
  gradeLevels,
  schoolMemberships,
  schools,
  students,
  subjects,
} from "@/db/schema";
import { getAccessibleSchools, getSession, isPlatformAdmin } from "@/lib/permissions";
import { AssessmentForm } from "./assessment-form";
import { changeAssessmentStatus } from "./actions";
import { ResultForm } from "./result-form";

export const metadata: Metadata = { title: "Assessments | Forma" };

async function AssessmentsContent() {
  const session = await getSession();
  if (!session) redirect("/login");

  const platformAdmin = isPlatformAdmin(session);
  const accessibleSchools = await getAccessibleSchools();
  const memberships = platformAdmin
    ? []
    : await db
      .select({ schoolId: schoolMemberships.schoolId, role: schoolMemberships.role })
      .from(schoolMemberships)
      .where(eq(schoolMemberships.userId, session.user.id));
  const schoolIds = platformAdmin
    ? accessibleSchools.map((school) => school.id)
    : memberships
      .filter(({ role }) => role === "school_admin" || role === "teacher")
      .map(({ schoolId }) => schoolId);
  if (schoolIds.length === 0) redirect("/no-access");

  const visibleSchools = accessibleSchools.filter((school) => schoolIds.includes(school.id));
  const canManageAssessments = platformAdmin || memberships.some(({ role }) => role === "school_admin" || role === "teacher");
  const [years, classroomsList, subjectList, assessmentRows] = await Promise.all([
    db.select({
      id: academicYears.id,
      schoolId: academicYears.schoolId,
      name: academicYears.name,
      isCurrent: academicYears.isCurrent,
    }).from(academicYears).where(inArray(academicYears.schoolId, schoolIds)),
    db.select({
      id: classrooms.id,
      schoolId: classrooms.schoolId,
      academicYearId: classrooms.academicYearId,
      name: classrooms.name,
      gradeName: gradeLevels.name,
    }).from(classrooms)
      .innerJoin(gradeLevels, eq(classrooms.gradeLevelId, gradeLevels.id))
      .where(inArray(classrooms.schoolId, schoolIds))
      .orderBy(gradeLevels.sortOrder, classrooms.name),
    db.select({
      id: subjects.id,
      schoolId: subjects.schoolId,
      name: subjects.name,
    }).from(subjects)
      .where(inArray(subjects.schoolId, schoolIds))
      .orderBy(subjects.name),
    db.select({
      id: assessments.id,
      schoolId: assessments.schoolId,
      schoolName: schools.name,
      academicYearId: assessments.academicYearId,
      yearName: academicYears.name,
      classroomId: assessments.classroomId,
      classroomName: classrooms.name,
      gradeName: gradeLevels.name,
      subjectName: subjects.name,
      title: assessments.title,
      instructions: assessments.instructions,
      status: assessments.status,
      maxScore: assessments.maxScore,
      createdAt: assessments.createdAt,
      creatorId: assessments.createdBy,
      creatorName: authUsers.name,
    }).from(assessments)
      .innerJoin(schools, eq(assessments.schoolId, schools.id))
      .innerJoin(academicYears, eq(assessments.academicYearId, academicYears.id))
      .innerJoin(classrooms, eq(assessments.classroomId, classrooms.id))
      .innerJoin(gradeLevels, eq(classrooms.gradeLevelId, gradeLevels.id))
      .innerJoin(subjects, eq(assessments.subjectId, subjects.id))
      .innerJoin(authUsers, eq(assessments.createdBy, authUsers.id))
      .where(inArray(assessments.schoolId, schoolIds))
      .orderBy(desc(assessments.createdAt))
      .limit(100),
  ]);

  const assessmentIds = assessmentRows.map((assessment) => assessment.id);
  const classroomIds = [...new Set(assessmentRows.map((assessment) => assessment.classroomId))];
  const [questionCounts, rosterRows, resultRows, attemptRows] = await Promise.all([
    assessmentIds.length
      ? db.select({ assessmentId: assessmentQuestions.assessmentId })
        .from(assessmentQuestions)
        .where(inArray(assessmentQuestions.assessmentId, assessmentIds))
      : Promise.resolve([]),
    classroomIds.length
      ? db.select({
        schoolId: enrollments.schoolId,
        classroomId: enrollments.classroomId,
        studentId: students.id,
        studentNumber: students.studentNumber,
        firstName: students.firstName,
        lastName: students.lastName,
      }).from(enrollments)
        .innerJoin(students, and(
          eq(enrollments.studentId, students.id),
          eq(students.schoolId, enrollments.schoolId),
          eq(students.status, "active"),
        ))
        .where(and(
          inArray(enrollments.classroomId, classroomIds),
          inArray(enrollments.schoolId, schoolIds),
          eq(enrollments.status, "enrolled"),
        ))
        .orderBy(students.lastName, students.firstName)
      : Promise.resolve([]),
    assessmentIds.length
      ? db.select({
        assessmentId: assessmentResults.assessmentId,
        studentId: assessmentResults.studentId,
        score: assessmentResults.score,
        feedback: assessmentResults.feedback,
      }).from(assessmentResults)
        .where(and(
          inArray(assessmentResults.assessmentId, assessmentIds),
          inArray(assessmentResults.schoolId, schoolIds),
        ))
      : Promise.resolve([]),
    assessmentIds.length
      ? db.select({
        assessmentId: assessmentAttempts.assessmentId,
        studentId: assessmentAttempts.studentId,
        score: assessmentAttempts.score,
        maxScore: assessmentAttempts.maxScore,
        submittedAt: assessmentAttempts.submittedAt,
      }).from(assessmentAttempts)
        .where(and(
          inArray(assessmentAttempts.assessmentId, assessmentIds),
          inArray(assessmentAttempts.schoolId, schoolIds),
        ))
      : Promise.resolve([]),
  ]);

  const questionCountByAssessment = new Map<string, number>();
  for (const question of questionCounts) {
    questionCountByAssessment.set(question.assessmentId, (questionCountByAssessment.get(question.assessmentId) ?? 0) + 1);
  }
  const resultByAssessmentAndStudent = new Map(
    resultRows.map((result) => [`${result.assessmentId}:${result.studentId}`, result]),
  );
  const attemptByAssessmentAndStudent = new Map(
    attemptRows.map((attempt) => [`${attempt.assessmentId}:${attempt.studentId}`, attempt]),
  );
  const isSchoolAdmin = (schoolId: string) =>
    platformAdmin || memberships.some((membership) => membership.schoolId === schoolId && membership.role === "school_admin");

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/" className="management-back">← Dashboard</Link>
          <p className="auth-eyebrow">ASSESSMENT &amp; RESULTS</p>
          <h1>Quizzes &amp; tests</h1>
          <p className="management-description">Create multiple-choice assessments and record marks for enrolled students.</p>
        </div>
      </header>
      <div className="management-sections">
        {canManageAssessments && <section className="management-card">
          <h2>Create an assessment</h2>
          <p className="assessment-help">Assessments start as drafts. A school administrator publishes them before results can be entered.</p>
          <AssessmentForm schools={visibleSchools} years={years} classrooms={classroomsList} subjects={subjectList} />
        </section>}
        <section className="management-card">
          <div className="management-card-heading">
            <div><h2>Assessments</h2><p>{assessmentRows.length} assessment{assessmentRows.length === 1 ? "" : "s"} in your authorized schools</p></div>
          </div>
          {assessmentRows.length === 0
            ? <p className="empty-state">No assessments yet. Set up your academic years, classes, and subjects, then create a quiz or test.</p>
            : <div className="assessment-list">
              {assessmentRows.map((assessment) => {
                const classRoster = rosterRows.filter((student) =>
                  student.schoolId === assessment.schoolId && student.classroomId === assessment.classroomId,
                );
                const assessedResults = classRoster.filter((student) =>
                  resultByAssessmentAndStudent.has(`${assessment.id}:${student.studentId}`),
                ).length;
                const onlineAttempts = classRoster.filter((student) =>
                  attemptByAssessmentAndStudent.has(`${assessment.id}:${student.studentId}`),
                ).length;
                const canPublish = isSchoolAdmin(assessment.schoolId) && assessment.status === "draft";
                const canClose = isSchoolAdmin(assessment.schoolId) && assessment.status === "published";
                return (
                  <article className="assessment-card" key={assessment.id}>
                    <div className="assessment-card-heading">
                      <div className="assessment-title-group">
                        <h3>{assessment.title}</h3>
                        <p>{assessment.schoolName} · {assessment.gradeName} {assessment.classroomName} · {assessment.subjectName} · {assessment.yearName}</p>
                      </div>
                      <span className={`role-badge status-${assessment.status}`}>{assessment.status}</span>
                    </div>
                    <div className="assessment-meta">
                      <span>{questionCountByAssessment.get(assessment.id) ?? 0} multiple-choice questions</span>
                      <span>{assessment.maxScore} points</span>
                      <span>Created by {assessment.creatorName}</span>
                    </div>
                    {assessment.instructions && <p className="assessment-instructions">{assessment.instructions}</p>}
                    {(canPublish || canClose) && (
                      <form action={changeAssessmentStatus} className="assessment-status-form">
                        <input name="schoolId" type="hidden" value={assessment.schoolId} />
                        <input name="assessmentId" type="hidden" value={assessment.id} />
                        <input name="status" type="hidden" value={canPublish ? "published" : "closed"} />
                        <button className="secondary-button" type="submit">{canPublish ? "Publish assessment" : "Close assessment"}</button>
                      </form>
                    )}
                    {(assessment.status === "published" || assessment.status === "closed") && (
                      <details className="assessment-results">
                        <summary>Student results <span>{onlineAttempts} online submissions · {assessedResults} staff marks</span></summary>
                        {classRoster.length === 0
                          ? <p className="empty-state">No active students are enrolled in this class yet.</p>
                          : <div className="results-list">
                            {classRoster.map((student) => {
                              const result = resultByAssessmentAndStudent.get(`${assessment.id}:${student.studentId}`);
                              const attempt = attemptByAssessmentAndStudent.get(`${assessment.id}:${student.studentId}`);
                              return <div className="student-result-row" key={student.studentId}>
                                {attempt && <p className="student-score">
                                  Online submission: <strong>{attempt.score} / {attempt.maxScore}</strong>
                                  {" · "}{attempt.submittedAt.toLocaleString()}
                                </p>}
                                {assessment.status === "published"
                                  ? <ResultForm
                                    schoolId={assessment.schoolId}
                                    assessmentId={assessment.id}
                                    studentId={student.studentId}
                                    studentName={`${student.firstName} ${student.lastName}`}
                                    studentNumber={student.studentNumber}
                                    maxScore={assessment.maxScore}
                                    currentScore={result?.score ?? null}
                                    feedback={result?.feedback ?? null}
                                  />
                                  : <div className="result-entry">
                                    <span className="result-student">
                                      <strong>{student.firstName} {student.lastName}</strong>
                                      <small>{student.studentNumber}</small>
                                    </span>
                                    <span className="student-score">
                                      {result
                                        ? `Staff mark: ${result.score} / ${assessment.maxScore}${result.feedback ? ` · ${result.feedback}` : ""}`
                                        : "No staff mark recorded"}
                                    </span>
                                  </div>}
                              </div>;
                            })}
                          </div>}
                      </details>
                    )}
                  </article>
                );
              })}
            </div>}
        </section>
      </div>
    </main>
  );
}

export default function AssessmentsPage() {
  return <Suspense fallback={<main className="auth-page"><p>Loading assessments...</p></main>}><AssessmentsContent /></Suspense>;
}
