import type { Metadata } from "next";
import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { gradeLevels, learningResources, subjects } from "@/db/schema";
import { withBasePath } from "@/lib/base-path";
import { resourceFileType } from "@/lib/learning-resources";
import { pageRoles, requireSchoolsFor } from "@/lib/workspace";
import { ResourceUploadForm } from "./resource-upload-form";

export const metadata: Metadata = { title: "Learning resources & Textbooks | Forma" };

async function ResourcesContent() {
  const { schoolIds: allowedSchoolIds, schools } = await requireSchoolsFor(pageRoles.academics);

  const resources = await db
    .select({
      id: learningResources.id,
      schoolId: learningResources.schoolId,
      gradeLevelId: learningResources.gradeLevelId,
      gradeName: gradeLevels.name,
      subjectId: learningResources.subjectId,
      subjectName: subjects.name,
      title: learningResources.title,
      description: learningResources.description,
      fileName: learningResources.fileName,
      sizeBytes: learningResources.sizeBytes,
      createdAt: learningResources.createdAt,
    })
    .from(learningResources)
    .leftJoin(gradeLevels, eq(learningResources.gradeLevelId, gradeLevels.id))
    .leftJoin(subjects, eq(learningResources.subjectId, subjects.id))
    .where(inArray(learningResources.schoolId, allowedSchoolIds))
    .orderBy(desc(learningResources.createdAt))
    .limit(100);

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/" className="management-back">← Dashboard</Link>
          <p className="auth-eyebrow">CURRICULUM &amp; TEXTBOOKS</p>
          <h1>Learning resources &amp; Textbooks</h1>
          <p className="management-description">
            Access curriculum textbooks (Grades 1–12), teacher guides, and learning resources. Link them directly to generate pedagogical lesson sequences, quizzes, and unit review exercises.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
          <Link href="/lessons/generate" className="primary-button" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
            <span>⚡ Generate Lesson Plans</span>
          </Link>
          <Link href="/assessments/generate" className="secondary-button" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
            <span>✨ Generate Quizzes &amp; Exercises</span>
          </Link>
        </div>
      </header>

      <div className="management-sections">
        <section className="management-card">
          <h2>Upload a new resource / textbook</h2>
          <ResourceUploadForm schools={schools} />
        </section>

        <section className="management-card">
          <div className="management-card-heading">
            <div>
              <h2>Resource &amp; Textbook Library</h2>
              <p>{resources.length} curriculum resource{resources.length === 1 ? "" : "s"} linked across grades and subjects</p>
            </div>
          </div>

          {resources.length === 0 ? (
            <p className="empty-state">No learning resources have been uploaded yet.</p>
          ) : (
            <div className="record-list">
              {resources.map((resource) => (
                <div className="record-row" key={resource.id} style={{ alignItems: "flex-start", gap: "1rem" }}>
                  <div className="record-primary" style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.35rem" }}>
                      <strong>{resource.title}</strong>
                      {resource.gradeName && (
                        <span style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "12px",
                          backgroundColor: "#fef3c7",
                          color: "#92400e",
                        }}>
                          {resource.gradeName}
                        </span>
                      )}
                      {resource.subjectName && (
                        <span style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "12px",
                          backgroundColor: "#e0e7ff",
                          color: "#3730a3",
                        }}>
                          {resource.subjectName}
                        </span>
                      )}
                    </div>
                    <small style={{ color: "#64748b" }}>
                      {schools.find((school) => school.id === resource.schoolId)?.name} · {resourceFileType(resource.fileName)?.category ?? "Resource"} · {formatBytes(resource.sizeBytes)}
                    </small>
                    <small style={{ display: "block", marginTop: "0.2rem" }}>
                      {resource.fileName}{resource.description ? ` · ${resource.description}` : ""}
                    </small>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <a
                      className="secondary-button"
                      style={{ padding: "0.35rem 0.75rem", fontSize: "0.82rem" }}
                      href={withBasePath(`/api/resources/${resource.id}`)}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open PDF
                    </a>
                    <Link
                      className="secondary-button"
                      style={{ padding: "0.35rem 0.75rem", fontSize: "0.82rem", backgroundColor: "#f0fdf4", color: "#166534", borderColor: "#bbf7d0" }}
                      href={`/lessons/generate?resourceId=${resource.id}${resource.gradeLevelId ? `&gradeLevelId=${resource.gradeLevelId}` : ""}${resource.subjectId ? `&subjectId=${resource.subjectId}` : ""}`}
                    >
                      Lesson Plans →
                    </Link>
                    <Link
                      className="secondary-button"
                      style={{ padding: "0.35rem 0.75rem", fontSize: "0.82rem", backgroundColor: "#faf5ff", color: "#6b21a8", borderColor: "#e9d5ff" }}
                      href={`/assessments/generate?resourceId=${resource.id}${resource.gradeLevelId ? `&gradeLevelId=${resource.gradeLevelId}` : ""}${resource.subjectId ? `&subjectId=${resource.subjectId}` : ""}`}
                    >
                      Quiz / Exercises →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ResourcesPage() {
  return (
    <Suspense fallback={<main className="auth-page"><p>Loading learning resources...</p></main>}>
      <ResourcesContent />
    </Suspense>
  );
}
