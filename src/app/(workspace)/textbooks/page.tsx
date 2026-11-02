import type { Metadata } from "next";
import { and, eq, isNotNull } from "drizzle-orm";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { gradeLevels, learningResources, subjects, textbookCatalog } from "@/db/schema";
import { withBasePath } from "@/lib/base-path";
import { curriculumSubject, gradeNumber, subjectTaughtInGrade } from "@/lib/ethiopian-curriculum";
import { allowedSourceUrl, canDownloadSource, uploadedSourceKey } from "@/lib/textbook-sources";
import { hasSchoolRole, pageRoles, requireSchoolsFor } from "@/lib/workspace";
import { AddGradeButton, AddToLibraryButton, CatalogEntryForm, CatalogMaintenance, RecheckButton, RemoveCatalogEntryButton } from "./forms";
import { TextbookUploadForm } from "./upload-form";

export const metadata: Metadata = { title: "Textbooks | Forma" };

type SearchParams = Promise<{ schoolId?: string }>;
type CatalogEntry = typeof textbookCatalog.$inferSelect;

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function TextbooksContent({ searchParams }: { searchParams: SearchParams }) {
  const { context, schoolIds, schools: visibleSchools } = await requireSchoolsFor(pageRoles.academics);
  const params = await searchParams;
  const schoolId = schoolIds.includes(params.schoolId ?? "") ? params.schoolId! : schoolIds[0];

  const [grades, schoolSubjects, books, catalog] = await Promise.all([
    db.select({ id: gradeLevels.id, name: gradeLevels.name }).from(gradeLevels)
      .where(eq(gradeLevels.schoolId, schoolId)).orderBy(gradeLevels.sortOrder, gradeLevels.name),
    db.select({ id: subjects.id, name: subjects.name }).from(subjects)
      .where(eq(subjects.schoolId, schoolId)).orderBy(subjects.name),
    db.select({
      id: learningResources.id,
      title: learningResources.title,
      description: learningResources.description,
      gradeLevelId: learningResources.gradeLevelId,
      subjectId: learningResources.subjectId,
      catalogEntryId: learningResources.catalogEntryId,
    }).from(learningResources)
      .where(and(eq(learningResources.schoolId, schoolId), isNotNull(learningResources.gradeLevelId), isNotNull(learningResources.subjectId))),
    db.select().from(textbookCatalog).orderBy(textbookCatalog.grade, textbookCatalog.subjectName, textbookCatalog.language),
  ]);

  // One row per grade and subject this school teaches, by the national curriculum.
  const rows = grades.flatMap((grade) => {
    const number = gradeNumber(grade.name);
    if (!number) return [];
    return [{
      grade,
      number,
      subjects: schoolSubjects
        .filter((subject) => subjectTaughtInGrade(subject.name, number))
        .map((subject) => {
          const canonical = curriculumSubject(subject.name)?.name;
          const library = books.filter((book) => book.gradeLevelId === grade.id && book.subjectId === subject.id);
          return {
            subject,
            entries: catalog.filter((entry) => entry.grade === number && entry.subjectName === canonical),
            libraryByEntry: new Map(library.filter((book) => book.catalogEntryId).map((book) => [book.catalogEntryId!, book])),
            uploads: library.filter((book) => !book.catalogEntryId),
          };
        }),
    }];
  });
  const pairs = rows.flatMap((row) => row.subjects);
  const withOfficial = pairs.filter((pair) => pair.entries.length > 0).length;
  const inLibrary = pairs.filter((pair) => pair.libraryByEntry.size > 0 || pair.uploads.length > 0).length;
  const mayAdd = hasSchoolRole(context, schoolId, ["school_admin", "teacher"]);
  const guides = catalog.filter((entry) => entry.kind === "teacher_guide").length;

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/" className="management-back">← Dashboard</Link>
          <p className="auth-eyebrow">CURRICULUM</p>
          <h1>Textbooks</h1>
          <p className="management-description">
            Official student textbooks and teacher guides for every grade and subject your school teaches. Add a book to the library — one at a time or a whole grade at once — or upload your own PDF, to open it in class and to generate lesson plans and quizzes from it.
          </p>
        </div>
      </header>
      <div className="management-sections">
        <section className="management-card">
          {visibleSchools.length > 1 && (
            <Form action="/textbooks" className="auth-form attendance-filter">
              <label>School
                <select defaultValue={schoolId} name="schoolId">
                  {visibleSchools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
                </select>
              </label>
              <button className="secondary-button" type="submit">Show textbooks</button>
            </Form>
          )}
          <div className="textbook-summary">
            <div><strong>{pairs.length}</strong><span>grade–subject pairs taught</span></div>
            <div><strong>{withOfficial}</strong><span>have an official textbook in the catalog</span></div>
            <div><strong>{inLibrary}</strong><span>have a textbook in the library</span></div>
            <div><strong>{catalog.length}</strong><span>books in the catalog ({guides} teacher guides)</span></div>
          </div>
          {rows.length === 0 && <p className="empty-state">This school has no grades yet. Set up Grades 1–12 with sections under <Link href="/academic-setup">Academic setup</Link>.</p>}
        </section>

        {mayAdd && rows.length > 0 && (
          <section className="management-card" id="upload">
            <h2>Upload a textbook or teacher guide</h2>
            <p className="management-description">For a grade and subject with no official copy yet, or your school&apos;s own edition. The PDF goes to this school&apos;s library.</p>
            <TextbookUploadForm grades={grades} schoolId={schoolId} subjects={schoolSubjects} />
          </section>
        )}

        {rows.map(({ grade, number, subjects: gradeSubjects }) => {
          const missing = gradeSubjects.flatMap((pair) => pair.entries.filter((entry) => canDownloadSource(entry) && !pair.libraryByEntry.has(entry.id) && entry.checkStatus !== "missing")).length;
          return (
          <section className="management-card" key={grade.id}>
            <div className="management-card-heading">
              <div>
                <h2>{grade.name}</h2>
                <p>{gradeSubjects.filter((pair) => pair.libraryByEntry.size || pair.uploads.length).length} of {gradeSubjects.length} subjects have a textbook in the library</p>
              </div>
              {mayAdd && missing > 0 && <AddGradeButton count={missing} grade={number} schoolId={schoolId} />}
            </div>
            {gradeSubjects.length === 0
              ? <p className="empty-state">No subjects of the national curriculum are set up for this grade.</p>
              : <div className="record-list">{gradeSubjects.map(({ subject, entries, libraryByEntry, uploads }) => (
                <div className="record-row textbook-row" key={subject.id}>
                  <div><strong>{subject.name}</strong></div>
                  <ul className="textbook-options">
                    {entries.map((entry) => (
                      <CatalogOption entry={entry} key={entry.id} libraryBookId={libraryByEntry.get(entry.id)?.id} schoolId={schoolId} />
                    ))}
                    {uploads.map((book) => (
                      <li key={book.id}>
                        <span>{book.title} <span className="role-badge">{book.description?.startsWith("Teacher guide") ? "teacher guide · uploaded" : "uploaded"}</span></span>
                        <span className="inline-actions">
                          <a className="text-link" href={withBasePath(`/api/resources/${book.id}`)} rel="noreferrer" target="_blank">Open</a>
                          <Link className="text-link" href={`/studio?resourceId=${book.id}`}>AI Studio →</Link>
                          <Link className="text-link" style={{ color: "#166534" }} href={`/lessons/generate?resourceId=${book.id}${book.gradeLevelId ? `&gradeLevelId=${book.gradeLevelId}` : ""}${book.subjectId ? `&subjectId=${book.subjectId}` : ""}`}>⚡ Lessons</Link>
                          <Link className="text-link" style={{ color: "#7e22ce" }} href={`/assessments/generate?resourceId=${book.id}${book.gradeLevelId ? `&gradeLevelId=${book.gradeLevelId}` : ""}${book.subjectId ? `&subjectId=${book.subjectId}` : ""}`}>✨ Quiz</Link>
                        </span>
                      </li>
                    ))}
                    {entries.length === 0 && uploads.length === 0 && (
                      <li className="textbook-missing">No official textbook found yet. {mayAdd ? <a className="text-link" href="#upload">Upload your copy</a> : "Ask an administrator to upload one."}</li>
                    )}
                  </ul>
                </div>
              ))}</div>}
          </section>
          );
        })}

        {context.platformAdmin && (
          <section className="management-card">
            <div className="management-card-heading">
              <div>
                <h2>Textbook catalog</h2>
                <p>{catalog.length} sources shared by every school. Downloads come only from the Oromia Education Bureau, the Ministry of Education&apos;s portals, the Google Drive copy of the Ministry&apos;s 2023 grade 9–12 textbooks, and PDFs uploaded here.</p>
              </div>
            </div>
            <CatalogMaintenance />
            <h3 className="org-subheading">Upload a PDF for every school</h3>
            <TextbookUploadForm catalog />
            <details className="field-edit">
              <summary>Add a source by web address</summary>
              <CatalogEntryForm />
            </details>
            <div className="record-list">
              {catalog.map((entry) => (
                <div className="record-row" key={entry.id}>
                  <div>
                    <strong>{entry.title}</strong>
                    <small>Grade {entry.grade} · {entry.subjectName} · {entry.kind === "teacher_guide" ? "Teacher guide" : "Student textbook"} · {entry.language} · {entry.publisher}{entry.sizeBytes ? ` · ${formatBytes(entry.sizeBytes)}` : ""}{uploadedSourceKey(entry.sourceUrl) ? " · uploaded here" : entry.directDownload ? "" : " · web page"}</small>
                  </div>
                  <span className={`role-badge status-${entry.checkStatus === "ok" ? "active" : "inactive"}`}>{entry.checkStatus}</span>
                  {allowedSourceUrl(entry.sourceUrl) && entry.directDownload && <RecheckButton catalogEntryId={entry.id} />}
                  <RemoveCatalogEntryButton catalogEntryId={entry.id} title={entry.title} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function CatalogOption({ entry, libraryBookId, schoolId }: { entry: CatalogEntry; libraryBookId?: string; schoolId: string }) {
  const downloadable = canDownloadSource(entry);
  return (
    <li>
      <span>
        {entry.kind === "teacher_guide" && <span className="role-badge">Teacher guide</span>} {entry.language}
        <small> · {entry.publisher}</small>
        {entry.checkStatus === "unreachable" && !libraryBookId && <small className="textbook-warning"> · source unreachable when last checked</small>}
        {entry.checkStatus === "missing" && !libraryBookId && <small className="textbook-warning"> · source no longer has this file</small>}
      </span>
      <span className="inline-actions">
        {libraryBookId ? (
          <>
            <span className="role-badge status-active">in library</span>
            <a className="text-link" href={withBasePath(`/api/resources/${libraryBookId}`)} rel="noreferrer" target="_blank">Open</a>
            <Link className="text-link" href={`/studio?resourceId=${libraryBookId}`}>AI Studio →</Link>
            <Link className="text-link" style={{ color: "#166534" }} href={`/lessons/generate?resourceId=${libraryBookId}&gradeLevelId=${entry.grade ? "" : ""}`}>⚡ Lessons</Link>
            <Link className="text-link" style={{ color: "#7e22ce" }} href={`/assessments/generate?resourceId=${libraryBookId}`}>✨ Quiz</Link>
          </>
        ) : downloadable ? (
          <AddToLibraryButton catalogEntryId={entry.id} schoolId={schoolId} sizeLabel={formatBytes(entry.sizeBytes)} />
        ) : (
          <a className="text-link" href={entry.sourceUrl} rel="noreferrer" target="_blank">Open source ↗</a>
        )}
      </span>
    </li>
  );
}

export default function TextbooksPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<main className="auth-page"><p>Loading textbooks...</p></main>}>
      <TextbooksContent searchParams={searchParams} />
    </Suspense>
  );
}
