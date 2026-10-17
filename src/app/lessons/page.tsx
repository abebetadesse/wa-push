import type { Metadata } from "next";
import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db";
import { academicYears, gradeLevels, lessonPlans, schoolMemberships, schools, subjects } from "@/db/schema";
import { getAccessibleSchools, getSession, isPlatformAdmin } from "@/lib/permissions";
import { updateLessonStatus } from "./actions";
import { LessonForm } from "./lesson-form";

export const metadata: Metadata = { title: "Lesson plans | Forma" };

async function LessonsContent() {
  const session = await getSession();
  if (!session) redirect("/login");
  const platformAdmin = isPlatformAdmin(session);
  const accessible = await getAccessibleSchools();
  const roles = platformAdmin
    ? []
    : await db
      .select({ schoolId: schoolMemberships.schoolId, role: schoolMemberships.role })
      .from(schoolMemberships)
      .where(eq(schoolMemberships.userId, session.user.id));
  const allowed = new Set(["school_admin", "teacher"]);
  const schoolIds = platformAdmin
    ? accessible.map((school) => school.id)
    : roles.filter(({ role }) => allowed.has(role)).map(({ schoolId }) => schoolId);
  if (schoolIds.length === 0) redirect("/no-access");

  const visibleSchools = accessible.filter((school) => schoolIds.includes(school.id));
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
  const canCreate = platformAdmin || roles.some(({ role }) => role === "school_admin" || role === "teacher");

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/" className="management-back">← Dashboard</Link>
          <p className="auth-eyebrow">TEACHING &amp; LEARNING</p>
          <h1>Lesson plans</h1>
          <p className="management-description">Create drafts, open a plan to write its full content, and move it through school review before publishing.</p>
        </div>
        <Link className="secondary-button" href="/timetable" style={{ display: "inline-flex", alignItems: "center", alignSelf: "flex-end" }}>Class timetable</Link>
      </header>
      <div className="management-sections">
        {canCreate && <section className="management-card">
          <h2>Create a lesson draft</h2>
          <LessonForm
            schools={visibleSchools}
            years={years}
            grades={grades}
            subjects={schoolSubjects}
          />
        </section>}
        <section className="management-card">
          <div className="management-card-heading"><div><h2>Recent lesson plans</h2><p>Latest 100 plans from your authorized schools</p></div></div>
          {plans.length === 0 ? <p className="empty-state">No lesson plans have been created yet.</p> : <div className="record-list">
            {plans.map((plan) => {
              const role = roles.find((member) => member.schoolId === plan.schoolId)?.role;
              const canSubmit = role === "teacher" && plan.createdBy === session.user.id && plan.status === "draft";
              const canReview = platformAdmin || role === "school_admin";
              const nextStatus = canSubmit ? "submitted" : plan.status === "submitted" ? "approved" : plan.status === "approved" ? "published" : null;
              return (
                <div className="record-row lesson-record" key={plan.id}>
                  <div className="record-primary">
                    <strong><Link className="text-link" href={`/lessons/${plan.id}`}>{plan.title}</Link></strong>
                    <small>{plan.schoolName} · {plan.gradeName} · {plan.subjectName}{plan.scheduledDate ? ` · ${plan.scheduledDate}` : ""}</small>
                    {plan.unitTopic && <small>{plan.unitTopic}</small>}
                  </div>
                  <span className={`role-badge status-${plan.status}`}>{plan.status}</span>
                  {nextStatus && (canSubmit || canReview) && <form action={updateLessonStatus}>
                    <input name="lessonId" type="hidden" value={plan.id} />
                    <input name="schoolId" type="hidden" value={plan.schoolId} />
                    <input name="status" type="hidden" value={nextStatus} />
                    <button className="secondary-button record-action" type="submit">
                      {nextStatus === "submitted" ? "Submit for review" : nextStatus === "approved" ? "Approve" : "Publish"}
                    </button>
                  </form>}
                </div>
              );
            })}
          </div>}
        </section>
      </div>
      {canCreate && <p className="auth-note">New plans are saved as drafts. Teachers may submit their drafts for school administrator review before publication.</p>}
    </main>
  );
}

export default function LessonsPage() {
  return <Suspense fallback={<main className="auth-page"><p>Loading lesson plans...</p></main>}><LessonsContent /></Suspense>;
}
