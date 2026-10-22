import type { Metadata } from "next";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { gradeLevels, learningResources, lessonPlans, subjects } from "@/db/schema";
import { withBasePath } from "@/lib/base-path";
import { resourceFileType } from "@/lib/learning-resources";
import { pageRoles, requireSchoolsFor } from "@/lib/workspace";

export const metadata: Metadata = { title: "Curriculum Browser | Forma" };

type SearchParams = Promise<{ grade?: string; subject?: string; schoolId?: string }>;

async function CurriculumContent({ searchParams }: { searchParams: SearchParams }) {
  const { schoolIds, schools } = await requireSchoolsFor(pageRoles.academics);
  const params = await searchParams;
  const selectedSchoolId = schoolIds.includes(params.schoolId ?? "")
    ? params.schoolId!
    : schoolIds[0];

  const [allGrades, allSubjects, allResources] = await Promise.all([
    db
      .select({ id: gradeLevels.id, name: gradeLevels.name, levelNumber: gradeLevels.levelNumber })
      .from(gradeLevels)
      .where(eq(gradeLevels.schoolId, selectedSchoolId))
      .orderBy(asc(gradeLevels.levelNumber)),
    db
      .select({ id: subjects.id, name: subjects.name, code: subjects.code })
      .from(subjects)
      .where(eq(subjects.schoolId, selectedSchoolId))
      .orderBy(asc(subjects.name)),
    db
      .select({
        id: learningResources.id,
        title: learningResources.title,
        description: learningResources.description,
        fileName: learningResources.fileName,
        sizeBytes: learningResources.sizeBytes,
        gradeLevelId: learningResources.gradeLevelId,
        subjectId: learningResources.subjectId,
        createdAt: learningResources.createdAt,
      })
      .from(learningResources)
      .where(inArray(learningResources.schoolId, schoolIds))
      .orderBy(desc(learningResources.createdAt))
      .limit(500),
  ]);

  const selectedGradeId = params.grade && allGrades.find((g) => g.id === params.grade)
    ? params.grade
    : null;
  const selectedSubjectId = params.subject && allSubjects.find((s) => s.id === params.subject)
    ? params.subject
    : null;

  // Filter resources by selection
  const filteredResources = allResources.filter((r) => {
    if (selectedGradeId && r.gradeLevelId !== selectedGradeId) return false;
    if (selectedSubjectId && r.subjectId !== selectedSubjectId) return false;
    return true;
  });

  // Count lesson plans per resource
  const resourceIds = filteredResources.map((r) => r.id);
  const lessonCounts = resourceIds.length
    ? await db
        .select({ resourceId: lessonPlans.resourceId, total: db.$count(lessonPlans.id) })
        .from(lessonPlans)
        .where(and(inArray(lessonPlans.schoolId, schoolIds), inArray(lessonPlans.resourceId!, resourceIds)))
        .groupBy(lessonPlans.resourceId)
    : [];
  const lessonCountMap = new Map(lessonCounts.map((r) => [r.resourceId, Number(r.total)]));

  const gradeMap = new Map(allGrades.map((g) => [g.id, g.name]));
  const subjectMap = new Map(allSubjects.map((s) => [s.id, s.name]));

  // Build grade-grouped curriculum summary
  const byGrade = new Map<string, { gradeName: string; subjects: Map<string, { subjectName: string; resourceCount: number }> }>();
  for (const r of allResources) {
    if (!r.gradeLevelId) continue;
    const gradeName = gradeMap.get(r.gradeLevelId) ?? "Unknown Grade";
    if (!byGrade.has(r.gradeLevelId)) {
      byGrade.set(r.gradeLevelId, { gradeName, subjects: new Map() });
    }
    if (r.subjectId) {
      const subjectName = subjectMap.get(r.subjectId) ?? "Unknown Subject";
      const gradeEntry = byGrade.get(r.gradeLevelId)!;
      const subEntry = gradeEntry.subjects.get(r.subjectId) ?? { subjectName, resourceCount: 0 };
      subEntry.resourceCount++;
      gradeEntry.subjects.set(r.subjectId, subEntry);
    }
  }

  const subjectColors: Record<string, string> = {
    Mathematics: "#dbeafe|#1e40af",
    English: "#fce7f3|#9d174d",
    Physics: "#fef3c7|#92400e",
    Chemistry: "#d1fae5|#065f46",
    Biology: "#dcfce7|#166534",
    Geography: "#e0f2fe|#0c4a6e",
    History: "#fef9c3|#713f12",
    "Information Technology": "#f3e8ff|#6b21a8",
    Economics: "#fff7ed|#9a3412",
    "Social Studies": "#f0fdf4|#14532d",
    "Civic and Ethical Education": "#fffbeb|#78350f",
    "Environmental Science": "#ecfdf5|#064e3b",
    Agriculture: "#fef3c7|#78350f",
    "Health and Physical Education": "#ffe4e6|#9f1239",
    "General Science": "#f1f5f9|#475569",
    Amharic: "#fdf4ff|#7e22ce",
    "Afan Oromo": "#f0fdf4|#065f46",
    "Performing and Visual Arts": "#fdf2f8|#86198f",
  };

  function getSubjectColor(subjectName: string) {
    const colors = subjectColors[subjectName];
    if (colors) {
      const [bg, text] = colors.split("|");
      return { backgroundColor: bg, color: text };
    }
    return { backgroundColor: "#f1f5f9", color: "#475569" };
  }

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/" className="management-back">← Dashboard</Link>
          <p className="auth-eyebrow">ETHIOPIAN MoE CURRICULUM</p>
          <h1>Curriculum Browser</h1>
          <p className="management-description">
            Browse the Ethiopian Ministry of Education curriculum (Grades 1–12) by grade level and subject.
            Each textbook links to auto-generated lesson plans, quizzes, and exercises.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
          <Link href="/lessons/generate" className="primary-button">
            ⚡ Generate Lesson Plans
          </Link>
          <Link href="/assessments/generate" className="secondary-button">
            ✨ Generate Quizzes
          </Link>
          <Link href="/resources" className="secondary-button">
            📚 All Resources
          </Link>
        </div>
      </header>

      <div className="management-sections">
        {/* Filters */}
        <section className="management-card" style={{ padding: "1.25rem 1.5rem" }}>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            {schools.length > 1 && (
              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.85rem", fontWeight: 600 }}>
                School
                <select
                  style={{ padding: "0.4rem 0.75rem", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "0.875rem" }}
                  defaultValue={selectedSchoolId}
                  onChange={(e) => {
                    const url = new URL(window.location.href);
                    url.searchParams.set("schoolId", e.target.value);
                    window.location.href = url.toString();
                  }}
                >
                  {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            )}
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.85rem", fontWeight: 600 }}>
              Grade Level
              <select
                style={{ padding: "0.4rem 0.75rem", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "0.875rem" }}
                defaultValue={selectedGradeId ?? ""}
              >
                <option value="">All Grades</option>
                {allGrades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.85rem", fontWeight: 600 }}>
              Subject
              <select
                style={{ padding: "0.4rem 0.75rem", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "0.875rem" }}
                defaultValue={selectedSubjectId ?? ""}
              >
                <option value="">All Subjects</option>
                {allSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <div style={{ fontSize: "0.82rem", color: "#64748b", paddingBottom: "0.5rem" }}>
              Showing <strong>{filteredResources.length}</strong> textbook{filteredResources.length === 1 ? "" : "s"}
            </div>
          </div>
        </section>

        {/* Curriculum Grade Overview (no filter applied) */}
        {!selectedGradeId && !selectedSubjectId && byGrade.size > 0 && (
          <section className="management-card">
            <div className="management-card-heading">
              <div>
                <h2>📘 Ethiopian Curriculum — Grade Overview</h2>
                <p>All {allGrades.length} grade levels linked to {allResources.length} textbooks across {allSubjects.length} subjects</p>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.75rem", marginTop: "1rem" }}>
              {Array.from(byGrade.entries()).map(([gradeId, gradeData]) => (
                <Link
                  key={gradeId}
                  href={`/curriculum?grade=${gradeId}`}
                  style={{
                    display: "block",
                    padding: "1rem",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
                    textDecoration: "none",
                    transition: "all 0.2s",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b", marginBottom: "0.25rem" }}>
                    {gradeData.gradeName}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#64748b", marginBottom: "0.5rem" }}>
                    {gradeData.subjects.size} subject{gradeData.subjects.size === 1 ? "" : "s"}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                    {Array.from(gradeData.subjects.values()).slice(0, 5).map((sub) => (
                      <span
                        key={sub.subjectName}
                        style={{
                          fontSize: "0.7rem",
                          padding: "2px 6px",
                          borderRadius: "8px",
                          fontWeight: 600,
                          ...getSubjectColor(sub.subjectName),
                        }}
                      >
                        {sub.subjectName}
                      </span>
                    ))}
                    {gradeData.subjects.size > 5 && (
                      <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                        +{gradeData.subjects.size - 5} more
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Filtered Textbook List */}
        <section className="management-card">
          <div className="management-card-heading">
            <div>
              <h2>📚 Textbooks & Learning Resources</h2>
              <p>
                {selectedGradeId ? gradeMap.get(selectedGradeId) : "All Grades"} ·{" "}
                {selectedSubjectId ? subjectMap.get(selectedSubjectId) : "All Subjects"} ·{" "}
                {filteredResources.length} resource{filteredResources.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          {filteredResources.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center" }}>
              <p className="empty-state">No textbooks found for the selected filters.</p>
              <Link href="/resources" className="primary-button" style={{ marginTop: "1rem", display: "inline-block" }}>
                Upload Textbooks
              </Link>
            </div>
          ) : (
            <div className="record-list">
              {filteredResources.map((resource) => {
                const gradeName = resource.gradeLevelId ? gradeMap.get(resource.gradeLevelId) : null;
                const subjectName = resource.subjectId ? subjectMap.get(resource.subjectId) : null;
                const lessonCount = lessonCountMap.get(resource.id) ?? 0;
                const fileType = resourceFileType(resource.fileName);

                return (
                  <div
                    key={resource.id}
                    className="record-row"
                    style={{ alignItems: "flex-start", gap: "1rem" }}
                  >
                    <div style={{ fontSize: "2rem", lineHeight: 1 }}>
                      {fileType?.category === "PDF" ? "📄" : fileType?.category === "Video" ? "🎥" : "📁"}
                    </div>
                    <div className="record-primary" style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.35rem" }}>
                        <strong>{resource.title}</strong>
                        {gradeName && (
                          <span style={{
                            fontSize: "0.74rem", fontWeight: 700, padding: "2px 8px",
                            borderRadius: "12px", backgroundColor: "#fef3c7", color: "#92400e",
                          }}>
                            {gradeName}
                          </span>
                        )}
                        {subjectName && (
                          <span style={{
                            fontSize: "0.74rem", fontWeight: 700, padding: "2px 8px",
                            borderRadius: "12px", ...getSubjectColor(subjectName),
                          }}>
                            {subjectName}
                          </span>
                        )}
                      </div>
                      {resource.description && (
                        <p style={{ fontSize: "0.82rem", color: "#475569", margin: "0 0 0.25rem" }}>
                          {resource.description}
                        </p>
                      )}
                      <small style={{ color: "#94a3b8" }}>
                        {resource.fileName} · {formatBytes(resource.sizeBytes)}
                        {lessonCount > 0 && (
                          <> · <span style={{ color: "#16a34a", fontWeight: 600 }}>✓ {lessonCount} lesson plan{lessonCount === 1 ? "" : "s"} generated</span></>
                        )}
                      </small>
                    </div>

                    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", justifyContent: "flex-end", minWidth: "200px" }}>
                      <a
                        className="secondary-button"
                        style={{ padding: "0.3rem 0.65rem", fontSize: "0.78rem" }}
                        href={withBasePath(`/api/resources/${resource.id}`)}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open PDF
                      </a>
                      <Link
                        className="secondary-button"
                        style={{ padding: "0.3rem 0.65rem", fontSize: "0.78rem", backgroundColor: "#f0fdf4", color: "#166534", borderColor: "#bbf7d0" }}
                        href={`/lessons/generate?resourceId=${resource.id}${resource.gradeLevelId ? `&gradeLevelId=${resource.gradeLevelId}` : ""}${resource.subjectId ? `&subjectId=${resource.subjectId}` : ""}`}
                      >
                        ⚡ Lessons
                      </Link>
                      <Link
                        className="secondary-button"
                        style={{ padding: "0.3rem 0.65rem", fontSize: "0.78rem", backgroundColor: "#faf5ff", color: "#6b21a8", borderColor: "#e9d5ff" }}
                        href={`/assessments/generate?resourceId=${resource.id}${resource.gradeLevelId ? `&gradeLevelId=${resource.gradeLevelId}` : ""}${resource.subjectId ? `&subjectId=${resource.subjectId}` : ""}`}
                      >
                        ✨ Quiz
                      </Link>
                    </div>
                  </div>
                );
              })}
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

export default function CurriculumPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<main className="auth-page"><p>Loading curriculum...</p></main>}>
      <CurriculumContent searchParams={searchParams} />
    </Suspense>
  );
}
