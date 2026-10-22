"use server";

import { guardAction, UserError, type ActionState } from "@/lib/action-result";

import { randomUUID } from "node:crypto";
import { mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { activityEvents, gradeLevels, learningResources, subjects, textbookCatalog } from "@/db/schema";
import { curriculumSubject, gradeNumber } from "@/lib/ethiopian-curriculum";
import { isDuplicateEntry } from "@/lib/db-errors";
import { resourceStorageDirectory } from "@/lib/learning-resources";
import { isPlatformAdmin, requireSchoolRole, requireSession } from "@/lib/permissions";
import { downloadTextbook } from "@/lib/textbook-download";
import { allowedSourceUrl, checkTextbookSource, sourceUrlHash } from "@/lib/textbook-sources";

async function addTextbookToLibraryImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const catalogEntryId = String(formData.get("catalogEntryId") ?? "").trim();
  if (!schoolId || !catalogEntryId) throw new UserError("Choose a textbook to add.");
  const { session } = await requireSchoolRole(schoolId, ["school_admin", "teacher"]);

  const [entry] = await db.select().from(textbookCatalog).where(eq(textbookCatalog.id, catalogEntryId)).limit(1);
  if (!entry) throw new UserError("That textbook is no longer in the catalog.");
  if (!entry.directDownload) throw new UserError("This source is a web page, not a file. Open it, download the PDF, and upload it under Resources.");

  const [existing] = await db.select({ id: learningResources.id }).from(learningResources)
    .where(and(eq(learningResources.schoolId, schoolId), eq(learningResources.catalogEntryId, entry.id)))
    .limit(1);
  if (existing) return { success: "This textbook is already in the library." };

  // Link the book to this school's grade and subject, when the school has them set up.
  const [schoolGrades, schoolSubjects] = await Promise.all([
    db.select({ id: gradeLevels.id, name: gradeLevels.name }).from(gradeLevels).where(eq(gradeLevels.schoolId, schoolId)),
    db.select({ id: subjects.id, name: subjects.name }).from(subjects).where(eq(subjects.schoolId, schoolId)),
  ]);
  const gradeLevelId = schoolGrades.find((grade) => gradeNumber(grade.name) === entry.grade)?.id ?? null;
  const subjectId = schoolSubjects.find((subject) => curriculumSubject(subject.name)?.name === entry.subjectName)?.id ?? null;

  const storageKey = randomUUID();
  const directory = resourceStorageDirectory(schoolId);
  const filePath = join(directory, storageKey);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const sizeBytes = await downloadTextbook(entry.sourceUrl, filePath);

  const fileName = decodeURIComponent(new URL(entry.sourceUrl).pathname.split("/").pop() ?? "")
    .replace(/[\u0000-\u001f\u007f/\\]/g, "")
    .slice(0, 255) || `${entry.title}.pdf`;
  try {
    await db.transaction(async (tx) => {
      await tx.insert(learningResources).values({
        schoolId,
        uploadedBy: session.user.id,
        gradeLevelId,
        subjectId,
        catalogEntryId: entry.id,
        title: entry.title.slice(0, 200),
        description: `Official textbook from ${entry.publisher}. Language: ${entry.language}.`,
        fileName,
        storageKey,
        contentType: "application/pdf",
        sizeBytes,
      });
      await tx.insert(activityEvents).values({
        schoolId,
        userId: session.user.id,
        detail: `Added textbook to the library: ${entry.title}`.slice(0, 255),
      });
    });
  } catch (error) {
    await unlink(filePath).catch(() => {});
    if (isDuplicateEntry(error)) return { success: "This textbook is already in the library." };
    throw error;
  }

  await db.update(textbookCatalog)
    .set({ checkStatus: "ok", sizeBytes, checkedAt: new Date() })
    .where(eq(textbookCatalog.id, entry.id));
  revalidatePath("/textbooks");
  revalidatePath("/resources");
  return { success: `“${entry.title}” was added to the library.` };
}

async function requirePlatformAdmin() {
  const session = await requireSession();
  if (!isPlatformAdmin(session)) throw new UserError("Only platform administrators can change the textbook catalog.");
  return session;
}

async function addCatalogEntryImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requirePlatformAdmin();
  const grade = Number(formData.get("grade"));
  const subject = curriculumSubject(String(formData.get("subjectName") ?? ""));
  const language = String(formData.get("language") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const publisher = String(formData.get("publisher") ?? "").trim();
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
  const directDownload = formData.get("directDownload") === "on";

  if (!Number.isInteger(grade) || grade < 1 || grade > 12) return { error: "Choose a grade from 1 to 12." };
  if (!subject) return { error: "Choose a subject." };
  if (!language || language.length > 40 || !title || title.length > 200 || !publisher || publisher.length > 160) {
    return { error: "Language, title and publisher are required and must fit their field limits." };
  }
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    return { error: "Enter the full web address of the textbook, starting with https://." };
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.href.length > 1000) {
    return { error: "Enter an http(s) web address of 1,000 characters or fewer." };
  }
  // Only official hosts are checked or downloaded from; others are kept as links to open.
  const allowed = allowedSourceUrl(url.href);
  const check = allowed ? await checkTextbookSource(allowed.href) : null;

  try {
    await db.insert(textbookCatalog).values({
      grade,
      subjectName: subject.name,
      language,
      title,
      publisher,
      sourceUrl: url.href,
      sourceUrlHash: sourceUrlHash(url.href),
      directDownload: directDownload && Boolean(allowed),
      sizeBytes: check?.sizeBytes ?? null,
      checkStatus: check?.status ?? "unchecked",
      checkedAt: check ? new Date() : null,
      addedBy: session.user.id,
    });
  } catch (error) {
    if (isDuplicateEntry(error)) return { error: "That web address is already in the catalog." };
    throw error;
  }
  revalidatePath("/textbooks");
  const note = allowed ? "" : ` ${url.hostname} isn't an official download host, so schools can open it but not download it into Forma.`;
  return { success: `Added “${title}” to the catalog.${note}` };
}

async function recheckCatalogEntryImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const catalogEntryId = String(formData.get("catalogEntryId") ?? "").trim();
  const [entry] = await db.select({ sourceUrl: textbookCatalog.sourceUrl }).from(textbookCatalog)
    .where(eq(textbookCatalog.id, catalogEntryId)).limit(1);
  if (!entry) throw new UserError("That textbook is no longer in the catalog.");
  const allowed = allowedSourceUrl(entry.sourceUrl);
  if (!allowed) throw new UserError("Only official download hosts are checked.");
  const check = await checkTextbookSource(allowed.href);
  await db.update(textbookCatalog)
    .set({ checkStatus: check.status, sizeBytes: check.sizeBytes, checkedAt: new Date() })
    .where(eq(textbookCatalog.id, catalogEntryId));
  revalidatePath("/textbooks");
  return {};
}

// Every action runs through guardAction, so a failure reaches the form as a message instead of
// a blank HTTP 500 (Next.js hides thrown messages in production).
export async function addTextbookToLibrary(...args: Parameters<typeof addTextbookToLibraryImpl>) {
  return guardAction(() => addTextbookToLibraryImpl(...args));
}
export async function addCatalogEntry(...args: Parameters<typeof addCatalogEntryImpl>) {
  return guardAction(() => addCatalogEntryImpl(...args));
}
export async function recheckCatalogEntry(...args: Parameters<typeof recheckCatalogEntryImpl>) {
  return guardAction(() => recheckCatalogEntryImpl(...args));
}
