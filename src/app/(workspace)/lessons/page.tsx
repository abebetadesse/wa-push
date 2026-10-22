import { ActionForm } from "@/components/action-form";
import type { Metadata } from "next";
import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { academicYears, gradeLevels, lessonPlans, schools, subjects } from "@/db/schema";
import { ListSearch } from "@/components/list-search";
import { SubmitButton } from "@/components/submit-button";
import { pageRoles, requireSchoolsFor } from "@/lib/workspace";
import { updateLessonStatus } from "./actions";
import { LessonForm } from "./lesson-form";

export const metadata: Metadata = { title: "Lesson plans | Forma" };

async function LessonsContent() {
  const { context, schoolIds, schools: visibleSchools, hasRole } = await requireSchoolsFor(pageRoles.academics);
  const [years, grades, schoolSubjects, plans] = await Promise.all([
    db.select({ id: academicYears.id, schoolId: academicYears.schoolId, name: academicYears.name, isCurrent: academicYears.isCurrent })
      .from(academicYears).where(inArray(academicYears.schoolId, schoolIds)),
    db.select({ id: gradeLevels.id, schoolId: gradeLevels.schoolId, name: gradeLevels.name })
      .from(gradeLevels).where(inArray(gradeLevels.schoolId, schoolIds)).orderBy(gradeLevels.sortOrder),
    db.select({ id: subjects.id, schoolId: subjects.schoolId, name: subjects.name })
      .from(subjects).where(inArray(subjects.schoolId, schoolIds)).orderBy(subjects.name),
    db.select({
      id: lessonPlans.id,
      schoolId: lessonPlans.schoolId,
      schoolName: schools.name,
      title: lessonPlans.title,
      unitTopic: lessonPlans.unitTopic,
      status: lessonPlans.status,
      scheduledDate: lessonPlans.scheduledDate,
      createdBy: lessonPlans.createdBy,
      createdAt: lessonPlans.createdAt,
      sourceResourceId: lessonPlans.sourceResourceId,
      subjectName: subjects.name,
      gradeName: gradeLevels.name,
    })
      .from(lessonPlans)
      .innerJoin(schools, eq(lessonPlans.schoolId, schools.id))
      .innerJoin(subjects, eq(lessonPlans.subjectId, subjects.id))
      .innerJoin(gradeLevels, eq(lessonPlans.gradeLevelId, gradeLevels.id))
      .where(inArray(lessonPlans.schoolId, schoolIds))
      .orderBy(desc(lessonPlans.createdAt))
      .limit(100),
  ]);
  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/" className="management-back">← Dashboard</Link>
          <p className="auth-eyebrow">TEACHING &amp; LEARNING</p>
          <h1>Lesson plans</h1>
          <p className="management-description">Create drafts, open a plan to write its full content, or auto-generate full unit plans from textbooks.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link className="primary-button" href="/lessons/generate">⚡ Auto-generate from textbook</Link>
          <Link className="secondary-button" href="/timetable">Class timetable</Link>
        </div>
      </header>
      <div className="management-sections">
        <section className="management-card">
          <h2>Create a lesson draft</h2>
          <LessonForm
            schools={visibleSchools}
            years={years}
            grades={grades}
            subjects={schoolSubjects}
          />
        </section>
        <section className="management-card">
          <div className="management-card-heading">
            <div><h2>Recent lesson plans</h2><p>Latest 100 plans from your authorized schools</p></div>
            {plans.length > 5 && <ListSearch targetId="lesson-list" label="Search lesson plans" placeholder="Search by title, subject, status…" />}
          </div>
          {plans.length === 0 ? <p className="empty-state">No lesson plans have been created yet.</p> : <div className="record-list" id="lesson-list">
            {plans.map((plan) => {
              const role = context.roles.find((member) => member.schoolId === plan.schoolId)?.role;
              const canSubmit = role === "teacher" && plan.createdBy === context.userId && plan.status === "draft";
              const canReview = hasRole(plan.schoolId, "school_admin");
              const nextStatus = canSubmit ? "submitted" : plan.status === "submitted" ? "approved" : plan.status === "approved" ? "published" : null;
              return (
                <div className="record-row lesson-record" key={plan.id}>
                  <div className="record-primary">
                    <strong><Link className="text-link" href={`/lessons/${plan.id}`}>{plan.title}</Link></strong>
                    <small>{plan.schoolName} · {plan.gradeName} · {plan.subjectName}{plan.scheduledDate ? ` · ${plan.scheduledDate}` : ""}</small>
                    {plan.unitTopic && <small>{plan.unitTopic}</small>}
                    {plan.sourceResourceId && <small style={{ color: "#2563eb", fontWeight: 600 }}>📚 Auto-generated from resource</small>}
                  </div>
                  <span className={`role-badge status-${plan.status}`}>{plan.status}</span>
                  {nextStatus && (canSubmit || canReview) && <ActionForm action={updateLessonStatus}>
                    <input name="lessonId" type="hidden" value={plan.id} />
                    <input name="schoolId" type="hidden" value={plan.schoolId} />
                    <input name="status" type="hidden" value={nextStatus} />
                    <SubmitButton pendingLabel="Saving…">
                      {nextStatus === "submitted" ? "Submit for review" : nextStatus === "approved" ? "Approve" : "Publish"}
                    </SubmitButton>
                  </ActionForm>}
                </div>
              );
            })}
          </div>}
        </section>
      </div>
      <p className="auth-note">New plans are saved as drafts. Teachers may submit their drafts for school administrator review before publication.</p>
    </main>
  );
}

export default function LessonsPage() {
  return <Suspense fallback={<main className="auth-page"><p>Loading lesson plans...</p></main>}><LessonsContent /></Suspense>;
}
