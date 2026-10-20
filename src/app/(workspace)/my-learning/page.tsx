import type { Metadata } from "next";
import { and, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db";
import {
  assessmentAttempts,
  assessmentQuestions,
  assessments,
  classrooms,
  enrollments,
  learningResources,
  schoolMemberships,
  schools,
  students,
  subjects,
} from "@/db/schema";
import { withBasePath } from "@/lib/base-path";
import { getSession } from "@/lib/permissions";
import { AssessmentTaker, type StudentAssessmentQuestion } from "./assessment-taker";

export const metadata: Metadata = { title: "My learning | Forma" };

async function MyLearningContent() {
  const session = await getSession();
  if (!session) redirect("/login");

  const studentRows = await db
    .select({ id: students.id, schoolId: students.schoolId })
    .from(students)
    .innerJoin(schoolMemberships, and(
      eq(schoolMemberships.userId, session.user.id),
      eq(schoolMemberships.schoolId, students.schoolId),
      eq(schoolMemberships.role, "student"),
    ))
    .where(and(
      eq(students.userId, session.user.id),
      eq(students.status, "active"),
    ));
  if (studentRows.length === 0) redirect("/no-access");

  const studentIds = studentRows.map((student) => student.id);
  const schoolIds = [...new Set(studentRows.map((student) => student.schoolId))];
  const [assignments, resources] = await Promise.all([db
    .select({
      studentId: enrollments.studentId,
      schoolId: assessments.schoolId,
      assessmentId: assessments.id,
      title: assessments.title,
      instructions: assessments.instructions,
      maxScore: assessments.maxScore,
      subjectName: subjects.name,
      className: classrooms.name,
      schoolName: schools.name,
    })
    .from(enrollments)
    .innerJoin(assessments, and(
      eq(assessments.schoolId, enrollments.schoolId),
      eq(assessments.classroomId, enrollments.classroomId),
      eq(assessments.academicYearId, enrollments.academicYearId),
      eq(assessments.status, "published"),
    ))
    .innerJoin(classrooms, and(
      eq(classrooms.id, assessments.classroomId),
      eq(classrooms.schoolId, assessments.schoolId),
    ))
    .innerJoin(subjects, and(
      eq(subjects.id, assessments.subjectId),
      eq(subjects.schoolId, assessments.schoolId),
    ))
    .innerJoin(schools, eq(schools.id, assessments.schoolId))
    .where(and(
      inArray(enrollments.studentId, studentIds),
      inArray(enrollments.schoolId, schoolIds),
      eq(enrollments.status, "enrolled"),
    ))
    .orderBy(desc(assessments.createdAt)),
    db.select({
      id: learningResources.id,
      title: learningResources.title,
      fileName: learningResources.fileName,
      contentType: learningResources.contentType,
      sizeBytes: learningResources.sizeBytes,
    }).from(learningResources)
      .where(inArray(learningResources.schoolId, schoolIds))
      .orderBy(desc(learningResources.createdAt))
      .limit(100),
  ]);

  const existingAttempts = assignments.length
    ? await db.select({
      assessmentId: assessmentAttempts.assessmentId,
      studentId: assessmentAttempts.studentId,
      score: assessmentAttempts.score,
      maxScore: assessmentAttempts.maxScore,
      submittedAt: assessmentAttempts.submittedAt,
    }).from(assessmentAttempts)
      .where(and(
        inArray(assessmentAttempts.assessmentId, [...new Set(assignments.map((assignment) => assignment.assessmentId))]),
        inArray(assessmentAttempts.studentId, studentIds),
        inArray(assessmentAttempts.schoolId, schoolIds),
      ))
    : [];
  const attemptByKey = new Map(existingAttempts.map((attempt) => [`${attempt.assessmentId}:${attempt.studentId}`, attempt]));
  const unanswered = assignments.filter((assignment) =>
    !attemptByKey.has(`${assignment.assessmentId}:${assignment.studentId}`),
  );
  const unansweredIds = [...new Set(unanswered.map((assignment) => assignment.assessmentId))];
  const questionRows = unansweredIds.length
    ? await db.select({
      id: assessmentQuestions.id,
      assessmentId: assessmentQuestions.assessmentId,
      questionText: assessmentQuestions.questionText,
      options: assessmentQuestions.options,
      sortOrder: assessmentQuestions.sortOrder,
    }).from(assessmentQuestions)
      .where(inArray(assessmentQuestions.assessmentId, unansweredIds))
      .orderBy(assessmentQuestions.sortOrder)
    : [];
  const questionsByAssessment = new Map<string, StudentAssessmentQuestion[]>();
  for (const question of questionRows) {
    const questions = questionsByAssessment.get(question.assessmentId) ?? [];
    questions.push({
      id: question.id,
      questionText: question.questionText,
      options: question.options,
    });
    questionsByAssessment.set(question.assessmentId, questions);
  }

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/" className="management-back">← Dashboard</Link>
          <p className="auth-eyebrow">STUDENT LEARNING</p>
          <h1>My learning</h1>
          <p className="management-description">Take published quizzes and access resources shared by your schools.</p>
        </div>
      </header>
      <div className="management-sections">
        <section className="management-card">
          <div className="management-card-heading"><div><h2>Learning resources</h2><p>Materials shared by your school</p></div></div>
          {resources.length === 0 ? <p className="empty-state">Your schools have not shared any learning resources yet.</p> : <div className="record-list">
            {resources.map((resource) => (
              <div className="record-row" key={resource.id}>
                <div className="record-primary">
                  <strong>{resource.title}</strong>
                  <small>{resource.fileName} · {resource.contentType.split("/")[0]} · {formatBytes(resource.sizeBytes)}</small>
                </div>
                <a className="secondary-button record-action" href={withBasePath(`/api/resources/${resource.id}`)} rel="noreferrer" target="_blank">Open / download</a>
              </div>
            ))}
          </div>}
        </section>
        {assignments.length === 0
          ? <section className="management-card"><p className="empty-state">There are no published assessments for your enrolled classes yet.</p></section>
          : assignments.map((assignment) => {
            const attempt = attemptByKey.get(`${assignment.assessmentId}:${assignment.studentId}`);
            const questions = questionsByAssessment.get(assignment.assessmentId) ?? [];
            return (
              <article className="management-card student-assessment-card" key={`${assignment.assessmentId}:${assignment.studentId}`}>
                <div className="management-card-heading">
                  <div><h2>{assignment.title}</h2><p>{assignment.schoolName} · {assignment.className} · {assignment.subjectName}</p></div>
                  <span className={`role-badge ${attempt ? "status-published" : "status-submitted"}`}>{attempt ? "Submitted" : "Ready"}</span>
                </div>
                {assignment.instructions && <p className="assessment-instructions">{assignment.instructions}</p>}
                {attempt
                  ? <p className="student-score">Your score: <strong>{attempt.score} / {attempt.maxScore}</strong> · Submitted {attempt.submittedAt.toLocaleString()}</p>
                  : questions.length > 0
                    ? <><p className="assessment-help">{questions.length} questions · {assignment.maxScore} possible points · one submission</p><AssessmentTaker assessmentId={assignment.assessmentId} questions={questions} /></>
                    : <p className="auth-error">This assessment is unavailable because it has no questions.</p>}
              </article>
            );
          })}
      </div>
    </main>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MyLearningPage() {
  return <Suspense fallback={<main className="auth-page"><p>Loading your assessments...</p></main>}><MyLearningContent /></Suspense>;
}
