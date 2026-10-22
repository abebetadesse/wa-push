import { ActionForm } from "@/components/action-form";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db";
import {
  academicYears,
  authUsers,
  classrooms,
  gradeLevels,
  lessonPlans,
  schools,
  subjects,
} from "@/db/schema";
import { requireWorkspaceContext } from "@/lib/workspace";
import { SubmitButton } from "@/components/submit-button";
import { updateLessonStatus } from "../actions";
import { canEditLesson, lessonSections } from "../lesson-access";
import { LessonEditForm } from "./lesson-edit-form";

export const metadata: Metadata = { title: "Lesson plan | Forma" };

async function LessonDetail({ lessonId }: { lessonId: string }) {
  const context = await requireWorkspaceContext();

  const [lesson] = await db
    .select({
      plan: lessonPlans,
      schoolName: schools.name,
      schoolStatus: schools.status,
      yearName: academicYears.name,
      gradeName: gradeLevels.name,
      subjectName: subjects.name,
      classroomName: classrooms.name,
      authorName: authUsers.name,
    })
    .from(lessonPlans)
    .innerJoin(schools, eq(lessonPlans.schoolId, schools.id))
    .innerJoin(academicYears, eq(lessonPlans.academicYearId, academicYears.id))
    .innerJoin(gradeLevels, eq(lessonPlans.gradeLevelId, gradeLevels.id))
    .innerJoin(subjects, eq(lessonPlans.subjectId, subjects.id))
    .leftJoin(classrooms, eq(lessonPlans.classroomId, classrooms.id))
    .leftJoin(authUsers, eq(lessonPlans.createdBy, authUsers.id))
    .where(eq(lessonPlans.id, lessonId))
    .limit(1);
  if (!lesson || lesson.schoolStatus === "suspended") notFound();

  const plan = lesson.plan;
  const { platformAdmin } = context;
  const role = context.roles.find((membership) => membership.schoolId === plan.schoolId)?.role;
  // Do not reveal whether a lesson exists in a school the user cannot access.
  if (!platformAdmin && role !== "school_admin" && role !== "teacher") notFound();

  const editable = canEditLesson({ role, userId: context.userId, platformAdmin, status: plan.status, createdBy: plan.createdBy });
  const canReview = platformAdmin || role === "school_admin";
  const isOwner = role === "teacher" && plan.createdBy === context.userId;
  const statusActions: { status: string; label: string }[] = [];
  if (isOwner && plan.status === "draft") statusActions.push({ status: "submitted", label: "Submit for review" });
  if (canReview && plan.status === "submitted") {
    statusActions.push({ status: "approved", label: "Approve" }, { status: "draft", label: "Return to draft" });
  }
  if (canReview && plan.status === "approved") statusActions.push({ status: "published", label: "Publish" });
  if (canReview && plan.status !== "archived") statusActions.push({ status: "archived", label: "Archive" });

  const [years, grades, schoolSubjects, schoolClassrooms] = editable
    ? await Promise.all([
      db.select({ id: academicYears.id, name: academicYears.name, isCurrent: academicYears.isCurrent })
        .from(academicYears).where(eq(academicYears.schoolId, plan.schoolId)).orderBy(academicYears.startsOn),
      db.select({ id: gradeLevels.id, name: gradeLevels.name })
        .from(gradeLevels).where(eq(gradeLevels.schoolId, plan.schoolId)).orderBy(gradeLevels.sortOrder),
      db.select({ id: subjects.id, name: subjects.name })
        .from(subjects).where(eq(subjects.schoolId, plan.schoolId)).orderBy(subjects.name),
      db.select({ id: classrooms.id, name: classrooms.name, academicYearId: classrooms.academicYearId, gradeLevelId: classrooms.gradeLevelId })
        .from(classrooms).where(eq(classrooms.schoolId, plan.schoolId)).orderBy(classrooms.name),
    ])
    : [[], [], [], []];

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/lessons" className="management-back">← Lesson plans</Link>
          <p className="auth-eyebrow">{lesson.schoolName.toUpperCase()}</p>
          <h1>{plan.title}</h1>
          <p className="management-description">
            {lesson.gradeName}{lesson.classroomName ? ` ${lesson.classroomName}` : ""} · {lesson.subjectName} · {lesson.yearName} · {plan.durationMinutes} minutes
            {plan.scheduledDate ? ` · ${plan.scheduledDate}` : ""}
          </p>
        </div>
        <span className={`role-badge status-${plan.status}`}>{plan.status}</span>
      </header>
      <div className="management-sections">
        <section className="management-card">
          <div className="management-card-heading">
            <div><h2>Lesson plan</h2><p>{plan.unitTopic ? `${plan.unitTopic} · ` : ""}Written by {lesson.authorName ?? "a former member"} · Updated {plan.updatedAt.toLocaleDateString()}</p></div>
          </div>
          {statusActions.length > 0 && <div className="modal-actions">
            {statusActions.map((item) => (
              <ActionForm action={updateLessonStatus} key={item.status}>
                <input name="lessonId" type="hidden" value={plan.id} />
                <input name="schoolId" type="hidden" value={plan.schoolId} />
                <input name="status" type="hidden" value={item.status} />
                <SubmitButton pendingLabel="Saving…">{item.label}</SubmitButton>
              </ActionForm>
            ))}
          </div>}
          {lessonSections.every((section) => !plan[section.name])
            ? <p className="empty-state">No lesson content has been written yet.</p>
            : lessonSections.filter((section) => plan[section.name]).map((section) => (
              <div key={section.name}>
                <h3>{section.label}</h3>
                <p className="assessment-instructions" style={{ whiteSpace: "pre-wrap" }}>{plan[section.name]}</p>
              </div>
            ))}
        </section>
        {editable && <section className="management-card">
          <h2>Edit lesson plan</h2>
          {plan.status !== "draft" && <p className="setup-hint">This plan is {plan.status}. Your edits keep its current status.</p>}
          <LessonEditForm
            lesson={plan}
            years={years}
            grades={grades}
            subjects={schoolSubjects}
            classrooms={schoolClassrooms}
          />
        </section>}
      </div>
    </main>
  );
}

async function LessonDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LessonDetail lessonId={id} />;
}

export default function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main className="auth-page"><p>Loading lesson plan...</p></main>}>
      <LessonDetailRoute params={params} />
    </Suspense>
  );
}
