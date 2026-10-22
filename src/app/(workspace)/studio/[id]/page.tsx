import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db";
import { academicYears, authUsers, classrooms, generatedMaterials, gradeLevels, learningResources, subjects } from "@/db/schema";
import { materialStatus } from "@/lib/ai-generation";
import { estimateCost, MATERIAL_LABELS } from "@/lib/ai-materials";
import { pageRoles, requireSchoolsFor } from "@/lib/workspace";
import { ApproveButton, DeleteButton, RefreshWhileGenerating, RetryButton, SaveLessonButton, SaveQuizForm } from "../forms";
import { MaterialView } from "../material-view";

export const metadata: Metadata = { title: "AI Studio | Forma" };

async function MaterialContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { context, schoolIds, hasRole } = await requireSchoolsFor(pageRoles.academics);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [row] = await db.select({
    material: generatedMaterials,
    resourceTitle: learningResources.title,
    gradeName: gradeLevels.name,
    subjectName: subjects.name,
    authorName: authUsers.name,
  }).from(generatedMaterials)
    .leftJoin(learningResources, eq(learningResources.id, generatedMaterials.resourceId))
    .leftJoin(gradeLevels, eq(gradeLevels.id, generatedMaterials.gradeLevelId))
    .leftJoin(subjects, eq(subjects.id, generatedMaterials.subjectId))
    .leftJoin(authUsers, eq(authUsers.id, generatedMaterials.createdBy))
    .where(eq(generatedMaterials.id, id))
    .limit(1);
  if (!row || !schoolIds.includes(row.material.schoolId)) notFound();
  const { material } = row;

  const status = materialStatus(material.status, material.createdAt);
  const isAdmin = hasRole(material.schoolId, "school_admin");
  const mayChange = isAdmin || material.createdBy === context.userId;
  const finished = material.status === "ready" || material.status === "approved";
  const cost = estimateCost(material.model, material);

  const classes = material.kind === "exam" && finished && !material.assessmentId
    ? await db.select({ id: classrooms.id, name: classrooms.name }).from(classrooms)
      .innerJoin(academicYears, and(eq(academicYears.id, classrooms.academicYearId), eq(academicYears.isCurrent, true)))
      .where(and(
        eq(classrooms.schoolId, material.schoolId),
        material.gradeLevelId ? eq(classrooms.gradeLevelId, material.gradeLevelId) : undefined,
      ))
      .orderBy(classrooms.name)
    : [];

  return (
    <main className="management-page">
      {status === "generating" && <RefreshWhileGenerating />}
      <header className="management-header">
        <div>
          <Link href="/studio" className="management-back">← AI Studio</Link>
          <p className="auth-eyebrow">{MATERIAL_LABELS[material.kind].toUpperCase()}</p>
          <h1>{material.title}</h1>
          <p className="management-description">
            From {row.resourceTitle ?? "a textbook that was removed"}{row.gradeName || row.subjectName ? ` · ${[row.gradeName, row.subjectName].filter(Boolean).join(" ")}` : ""} · scope “{material.scope}” · asked by {row.authorName ?? "a former member"}
          </p>
        </div>
      </header>
      <div className="management-sections">
        <section className="management-card">
          <div className="management-card-heading">
            <div>
              <h2>
                <span className={`role-badge status-${finished ? "active" : status === "generating" ? "on_leave" : "inactive"}`}>{status}</span>
              </h2>
              {finished && <p>Written by {material.model}{cost !== null ? ` · about US$${cost.toFixed(2)} (${material.inputTokens?.toLocaleString()} input, ${material.cachedInputTokens?.toLocaleString()} cached, ${material.outputTokens?.toLocaleString()} output tokens)` : ""}</p>}
            </div>
            <div className="inline-actions">
              {material.status === "ready" && isAdmin && <ApproveButton materialId={material.id} />}
              {finished && material.kind === "lesson_plan" && (material.lessonPlanId
                ? <Link className="secondary-button record-action" href={`/lessons/${material.lessonPlanId}`}>Open lesson plan</Link>
                : <SaveLessonButton materialId={material.id} />)}
              {(status === "failed" || status === "interrupted") && mayChange && <RetryButton materialId={material.id} />}
              {mayChange && status !== "generating" && <DeleteButton materialId={material.id} />}
            </div>
          </div>

          {status === "generating" && <p className="empty-state"><span className="button-spinner" aria-hidden="true" /> Claude is reading the textbook and writing. This usually takes one to three minutes; the page updates by itself.</p>}
          {status === "interrupted" && <p className="auth-error">The server restarted while this was being written. Try again.</p>}
          {status === "failed" && <p className="auth-error" role="alert">{material.error ?? "Generation failed."}</p>}

          {finished && material.kind === "exam" && (
            <div className="material-actions">
              {material.assessmentId
                ? <Link className="text-link" href="/assessments">Saved as a quiz: open Quizzes &amp; tests →</Link>
                : classes.length > 0
                  ? <SaveQuizForm classes={classes} materialId={material.id} />
                  : <p className="report-note">Add a class for this grade in the current academic year to put the multiple-choice part online.</p>}
            </div>
          )}

          {finished && material.content !== null && <MaterialView content={material.content} kind={material.kind} />}
          {finished && <p className="report-note">Prepared by AI from the textbook. Check facts, level and language before using it in class.</p>}
        </section>
      </div>
    </main>
  );
}

export default function MaterialPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<main className="auth-page"><p>Loading material...</p></main>}><MaterialContent params={params} /></Suspense>;
}
