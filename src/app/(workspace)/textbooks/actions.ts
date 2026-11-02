"use server";

import { guardAction, UserError, type ActionState } from "@/lib/action-result";

import { randomUUID } from "node:crypto";
import { mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import officialSources from "@/data/textbook-sources.json";
import { db } from "@/db";
import { activityEvents, gradeLevels, learningResources, subjects, textbookCatalog } from "@/db/schema";
import { curriculumSubject, gradeNumber } from "@/lib/ethiopian-curriculum";
import { isDuplicateEntry } from "@/lib/db-errors";
import { resourceStorageDirectory } from "@/lib/learning-resources";
import { isPlatformAdmin, requireSchoolRole, requireSession } from "@/lib/permissions";
import { catalogUploadPath, provideCatalogFile } from "@/lib/textbook-download";
import { allowedSourceUrl, canDownloadSource, checkTextbookSource, sourceUrlHash, uploadedSourceKey } from "@/lib/textbook-sources";

type CatalogEntry = typeof textbookCatalog.$inferSelect;

const runningGradeDownloads = new Set<string>();

const KIND_LABELS = { student_textbook: "Student textbook", teacher_guide: "Teacher guide" } as const;

/**
 * Copies one catalog book into a school's library, linked to the school's grade and subject when it
 * has them. Returns false when the school already has it.
 */
async function addEntryToSchool(schoolId: string, userId: string, entry: CatalogEntry) {
  const [existing] = await db.select({ id: learningResources.id }).from(learningResources)
    .where(and(eq(learningResources.schoolId, schoolId), eq(learningResources.catalogEntryId, entry.id)))
    .limit(1);
  if (existing) return false;

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
  const sizeBytes = await provideCatalogFile(entry, filePath);

  const sourceName = uploadedSourceKey(entry.sourceUrl) ? "" : decodeURIComponent(new URL(entry.sourceUrl).pathname.split("/").pop() ?? "");
  const fileName = (/\.pdf$/i.test(sourceName) ? sourceName : `${entry.title}.pdf`)
    .replace(/[\u0000-\u001f\u007f/\\]/g, "")
    .slice(0, 255);
  try {
    await db.transaction(async (tx) => {
      await tx.insert(learningResources).values({
        schoolId,
        uploadedBy: userId,
        gradeLevelId,
        subjectId,
        catalogEntryId: entry.id,
        title: entry.title.slice(0, 200),
        description: `${KIND_LABELS[entry.kind]} from ${entry.publisher}. Language: ${entry.language}.`,
        fileName,
        storageKey,
        contentType: "application/pdf",
        sizeBytes,
      });
      await tx.insert(activityEvents).values({
        schoolId,
        userId,
        detail: `Added to the library: ${entry.title}`.slice(0, 255),
      });
    });
  } catch (error) {
    await unlink(filePath).catch(() => {});
    if (isDuplicateEntry(error)) return false;
    throw error;
  }
  await db.update(textbookCatalog)
    .set({ checkStatus: "ok", sizeBytes, checkedAt: new Date() })
    .where(eq(textbookCatalog.id, entry.id));
  return true;
}

async function addTextbookToLibraryImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const catalogEntryId = String(formData.get("catalogEntryId") ?? "").trim();
  if (!schoolId || !catalogEntryId) throw new UserError("Choose a textbook to add.");
  const { session } = await requireSchoolRole(schoolId, ["school_admin", "teacher"]);

  const [entry] = await db.select().from(textbookCatalog).where(eq(textbookCatalog.id, catalogEntryId)).limit(1);
  if (!entry) throw new UserError("That textbook is no longer in the catalog.");
  if (!canDownloadSource(entry)) throw new UserError("This source is a web page, not a file. Open it, download the PDF, and upload it here.");

  const added = await addEntryToSchool(schoolId, session.user.id, entry);
  revalidatePath("/textbooks");
  revalidatePath("/resources");
  return { success: added ? `“${entry.title}” was added to the library.` : "This textbook is already in the library." };
}

/**
 * Adds every downloadable catalog book of one grade (student textbooks and teacher guides) for the
 * subjects the school teaches. The downloads run after the reply, one at a time, so a slow source
 * cannot time the request out; the page shows each book as it arrives.
 */
async function addGradeTextbooksImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const grade = Number(formData.get("grade"));
  if (!schoolId || !Number.isInteger(grade) || grade < 1 || grade > 12) throw new UserError("Choose a grade.");
  const { session } = await requireSchoolRole(schoolId, ["school_admin", "teacher"]);

  const [entries, schoolSubjects, owned] = await Promise.all([
    db.select().from(textbookCatalog).where(eq(textbookCatalog.grade, grade)),
    db.select({ name: subjects.name }).from(subjects).where(eq(subjects.schoolId, schoolId)),
    db.select({ catalogEntryId: learningResources.catalogEntryId }).from(learningResources).where(eq(learningResources.schoolId, schoolId)),
  ]);
  const taught = new Set(schoolSubjects.map((subject) => curriculumSubject(subject.name)?.name).filter(Boolean));
  const ownedIds = new Set(owned.map((row) => row.catalogEntryId));
  const pending = entries.filter((entry) => canDownloadSource(entry) && taught.has(entry.subjectName) && !ownedIds.has(entry.id) && entry.checkStatus !== "missing");
  if (pending.length === 0) return { success: `Every available Grade ${grade} book is already in the library.` };

  // One bulk download per school and grade at a time, so repeated clicks don't pile up.
  const job = `${schoolId}:${grade}`;
  if (runningGradeDownloads.has(job)) return { success: `Grade ${grade}'s books are already downloading. Reload the page in a few minutes.` };
  runningGradeDownloads.add(job);
  const userId = session.user.id;
  after(async () => {
    try {
      for (const entry of pending) {
        try {
          await addEntryToSchool(schoolId, userId, entry);
          // A short pause between books keeps the hosts from refusing the next connection.
          await new Promise((resolve) => setTimeout(resolve, 2_000));
        } catch (error) {
          console.warn(`[forma] could not add “${entry.title}” to school ${schoolId}:`, error instanceof Error ? error.message : error);
          // A full disk stops the whole batch instead of trying every remaining book.
          if (error instanceof UserError && error.message.startsWith("The server's storage is full")) break;
        }
      }
    } finally {
      runningGradeDownloads.delete(job);
    }
  });
  return { success: `Downloading ${pending.length} Grade ${grade} book${pending.length === 1 ? "" : "s"} in the background. Reload the page in a few minutes to see them.` };
}

async function requirePlatformAdmin() {
  const session = await requireSession();
  if (!isPlatformAdmin(session)) throw new UserError("Only platform administrators can change the textbook catalog.");
  return session;
}

const CATALOG_KINDS = ["student_textbook", "teacher_guide"] as const;

async function addCatalogEntryImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requirePlatformAdmin();
  const grade = Number(formData.get("grade"));
  const subject = curriculumSubject(String(formData.get("subjectName") ?? ""));
  const kind = String(formData.get("kind") ?? "student_textbook") as (typeof CATALOG_KINDS)[number];
  const language = String(formData.get("language") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const publisher = String(formData.get("publisher") ?? "").trim();
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
  const directDownload = formData.get("directDownload") === "on";

  if (!Number.isInteger(grade) || grade < 1 || grade > 12) return { error: "Choose a grade from 1 to 12." };
  if (!subject) return { error: "Choose a subject." };
  if (!CATALOG_KINDS.includes(kind)) return { error: "Choose a student textbook or a teacher guide." };
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
  const check = allowed && directDownload ? await checkTextbookSource(allowed.href) : null;

  try {
    await db.insert(textbookCatalog).values({
      grade,
      subjectName: subject.name,
      language,
      kind,
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

type OfficialSource = {
  grade: number;
  subjectName: string;
  language: string;
  kind: (typeof CATALOG_KINDS)[number];
  title: string;
  publisher: string;
  sourceUrl: string;
  directDownload: boolean;
  sizeBytes?: number;
};

/**
 * Adds the curated list of official textbooks and teacher guides (src/data/textbook-sources.json)
 * to the catalog; entries already there are updated. Nothing is downloaded.
 */
async function loadOfficialCatalogImpl(): Promise<ActionState> {
  const session = await requirePlatformAdmin();
  const sources = officialSources as OfficialSource[];
  let added = 0;
  for (const source of sources) {
    if (!curriculumSubject(source.subjectName)) continue;
    const values = {
      grade: source.grade,
      subjectName: source.subjectName,
      language: source.language,
      kind: source.kind,
      title: source.title,
      publisher: source.publisher,
      directDownload: source.directDownload,
    };
    const result = await db.insert(textbookCatalog)
      .values({ ...values, sourceUrl: source.sourceUrl, sourceUrlHash: sourceUrlHash(source.sourceUrl), sizeBytes: source.sizeBytes ?? null, addedBy: session.user.id })
      .onDuplicateKeyUpdate({ set: values });
    // MySQL reports 1 affected row for a new row and 2 (or 0 when unchanged) for an existing one.
    if ((result[0] as { affectedRows?: number }).affectedRows === 1) added += 1;
  }
  revalidatePath("/textbooks");
  return { success: `Loaded the official list: ${added} new source${added === 1 ? "" : "s"}, ${sources.length - added} already in the catalog.` };
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

/** Checks every downloadable source of the catalog, two at a time (Drive refuses bursts), after the reply. */
async function recheckCatalogImpl(): Promise<ActionState> {
  await requirePlatformAdmin();
  const entries = (await db.select({ id: textbookCatalog.id, sourceUrl: textbookCatalog.sourceUrl, directDownload: textbookCatalog.directDownload }).from(textbookCatalog))
    .filter((entry) => entry.directDownload && allowedSourceUrl(entry.sourceUrl));
  after(async () => {
    for (let start = 0; start < entries.length; start += 2) {
      await Promise.all(entries.slice(start, start + 2).map(async (entry) => {
        const check = await checkTextbookSource(entry.sourceUrl);
        await db.update(textbookCatalog).set({ checkStatus: check.status, sizeBytes: check.sizeBytes, checkedAt: new Date() })
          .where(eq(textbookCatalog.id, entry.id));
      }));
    }
  });
  return { success: `Checking ${entries.length} sources in the background. Reload in a minute or two to see the results.` };
}

/** Removes a catalog entry. Schools keep the copies already in their libraries. */
async function removeCatalogEntryImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const catalogEntryId = String(formData.get("catalogEntryId") ?? "").trim();
  const [entry] = await db.select().from(textbookCatalog).where(eq(textbookCatalog.id, catalogEntryId)).limit(1);
  if (!entry) return {};
  await db.delete(textbookCatalog).where(eq(textbookCatalog.id, entry.id));
  // The shared copy goes; schools' copies are links of their own and stay readable.
  await unlink(catalogUploadPath(uploadedSourceKey(entry.sourceUrl) ?? entry.id)).catch(() => {});
  revalidatePath("/textbooks");
  return {};
}

// Every action runs through guardAction, so a failure reaches the form as a message instead of
// a blank HTTP 500 (Next.js hides thrown messages in production).
export async function addTextbookToLibrary(...args: Parameters<typeof addTextbookToLibraryImpl>) {
  return guardAction(() => addTextbookToLibraryImpl(...args));
}
export async function addGradeTextbooks(...args: Parameters<typeof addGradeTextbooksImpl>) {
  return guardAction(() => addGradeTextbooksImpl(...args));
}
export async function addCatalogEntry(...args: Parameters<typeof addCatalogEntryImpl>) {
  return guardAction(() => addCatalogEntryImpl(...args));
}
// Called by a form, so it takes (and ignores) the form state and data.
export async function loadOfficialCatalog(...args: [ActionState, FormData]) {
  void args;
  return guardAction(() => loadOfficialCatalogImpl());
}
export async function recheckCatalogEntry(...args: Parameters<typeof recheckCatalogEntryImpl>) {
  return guardAction(() => recheckCatalogEntryImpl(...args));
}
export async function recheckCatalog(...args: [ActionState, FormData]) {
  void args;
  return guardAction(() => recheckCatalogImpl());
}
export async function removeCatalogEntry(...args: Parameters<typeof removeCatalogEntryImpl>) {
  return guardAction(() => removeCatalogEntryImpl(...args));
}
