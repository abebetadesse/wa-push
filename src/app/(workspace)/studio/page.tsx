import type { Metadata } from "next";
import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { generatedMaterials, gradeLevels, learningResources, schools, subjects } from "@/db/schema";
import { aiConfigured, aiReadableResource, materialStatus } from "@/lib/ai-generation";
import { MATERIAL_LABELS } from "@/lib/ai-materials";
import { pageRoles, requireSchoolsFor } from "@/lib/workspace";
import { GenerateForm } from "./forms";

export const metadata: Metadata = { title: "AI Studio | Forma" };

type SearchParams = Promise<{ resourceId?: string; kind?: string }>;

async function StudioContent({ searchParams }: { searchParams: SearchParams }) {
  const { schoolIds, schools: visibleSchools } = await requireSchoolsFor(pageRoles.academics);
  const params = await searchParams;

  const [library, materials] = await Promise.all([
    db.select({
      id: learningResources.id,
      schoolId: learningResources.schoolId,
      title: learningResources.title,
      fileName: learningResources.fileName,
      sizeBytes: learningResources.sizeBytes,
      gradeName: gradeLevels.name,
      subjectName: subjects.name,
    }).from(learningResources)
      .leftJoin(gradeLevels, eq(gradeLevels.id, learningResources.gradeLevelId))
      .leftJoin(subjects, eq(subjects.id, learningResources.subjectId))
      .where(inArray(learningResources.schoolId, schoolIds))
      .orderBy(gradeLevels.sortOrder, subjects.name, learningResources.title),
    db.select({
      id: generatedMaterials.id,
      kind: generatedMaterials.kind,
      title: generatedMaterials.title,
      status: generatedMaterials.status,
      createdAt: generatedMaterials.createdAt,
      schoolName: schools.name,
      gradeName: gradeLevels.name,
      subjectName: subjects.name,
    }).from(generatedMaterials)
      .innerJoin(schools, eq(schools.id, generatedMaterials.schoolId))
      .leftJoin(gradeLevels, eq(gradeLevels.id, generatedMaterials.gradeLevelId))
      .leftJoin(subjects, eq(subjects.id, generatedMaterials.subjectId))
      .where(inArray(generatedMaterials.schoolId, schoolIds))
      .orderBy(desc(generatedMaterials.createdAt))
      .limit(50),
  ]);

  // Placeholder files from the old seed are a few KB of text named .pdf; Claude can't use them.
  const textbooks = library
    .filter((book) => aiReadableResource(book.fileName) && book.sizeBytes > 20_000)
    .map((book) => ({
      id: book.id,
      schoolId: book.schoolId,
      label: [book.gradeName, book.subjectName, book.title].filter(Boolean).join(" · "),
    }));
  const preselected = textbooks.find((book) => book.id === params.resourceId);
  const configured = aiConfigured();

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/" className="management-back">← Dashboard</Link>
          <p className="auth-eyebrow">TEACHING MATERIAL</p>
          <h1>AI Studio</h1>
          <p className="management-description">Claude reads a textbook from your library and prepares a lesson plan, lecture notes, an assignment or an exam for the unit you choose.</p>
        </div>
      </header>
      <div className="management-sections">
        <section className="management-card">
          <h2>Prepare material</h2>
          {configured
            ? <GenerateForm defaults={{ schoolId: preselected?.schoolId ?? schoolIds[0], resourceId: preselected?.id, kind: params.kind }} schools={visibleSchools} textbooks={textbooks} />
            : <p className="empty-state">AI generation isn&apos;t set up yet. An administrator needs to add <code>ANTHROPIC_API_KEY</code> to the server&apos;s settings and restart it.</p>}
          <p className="report-note">No textbook listed? Add one from <Link href="/textbooks">Textbooks</Link> or upload a PDF under <Link href="/resources">Resources</Link>.</p>
        </section>
        <section className="management-card">
          <div className="management-card-heading"><div><h2>Prepared material</h2><p>{materials.length} item{materials.length === 1 ? "" : "s"}</p></div></div>
          {materials.length === 0
            ? <p className="empty-state">Nothing prepared yet.</p>
            : <div className="record-list">{materials.map((material) => {
              const status = materialStatus(material.status, material.createdAt);
              return (
                <div className="record-row" key={material.id}>
                  <div>
                    <Link className="text-link" href={`/studio/${material.id}`}><strong>{material.title}</strong></Link>
                    <small>{MATERIAL_LABELS[material.kind]} · {[material.gradeName, material.subjectName].filter(Boolean).join(" ")} · {material.schoolName} · {material.createdAt.toISOString().slice(0, 10)}</small>
                  </div>
                  <span className={`role-badge status-${status === "ready" || status === "approved" ? "active" : status === "generating" ? "on_leave" : "inactive"}`}>{status}</span>
                </div>
              );
            })}</div>}
        </section>
      </div>
    </main>
  );
}

export default function StudioPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<main className="auth-page"><p>Loading AI Studio...</p></main>}><StudioContent searchParams={searchParams} /></Suspense>;
}
