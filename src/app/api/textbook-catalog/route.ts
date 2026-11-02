import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { textbookCatalog } from "@/db/schema";
import { curriculumSubject } from "@/lib/ethiopian-curriculum";
import { MAX_RESOURCE_BYTES, resourceStorageDirectory } from "@/lib/learning-resources";
import { getSession, isPlatformAdmin } from "@/lib/permissions";
import { CATALOG_STORAGE_ID, catalogUploadPath } from "@/lib/textbook-download";
import { sourceUrlHash, UPLOADED_SOURCE_PREFIX } from "@/lib/textbook-sources";

// A platform administrator uploads a textbook or teacher guide PDF once; it joins the catalog every
// school sees, and schools add it to their library with one click (a copy of this file).
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !isPlatformAdmin(session)) return NextResponse.json({ error: "Only platform administrators can add to the textbook catalog." }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_RESOURCE_BYTES + 1024 * 1024) {
    return NextResponse.json({ error: "Uploads are limited to 100 MB." }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "The upload could not be read. Choose a file and try again." }, { status: 400 });
  }
  const grade = Number(formData.get("grade"));
  const subject = curriculumSubject(String(formData.get("subjectName") ?? ""));
  const kind = String(formData.get("kind") ?? "");
  const language = String(formData.get("language") ?? "").trim();
  const publisher = String(formData.get("publisher") ?? "").trim() || "Ministry of Education, FDRE";
  const file = formData.get("file");
  if (!Number.isInteger(grade) || grade < 1 || grade > 12 || !subject) return NextResponse.json({ error: "Choose a grade and a subject." }, { status: 400 });
  if (kind !== "student_textbook" && kind !== "teacher_guide") return NextResponse.json({ error: "Choose a student textbook or a teacher guide." }, { status: 400 });
  if (!language || language.length > 40 || publisher.length > 160) return NextResponse.json({ error: "Enter the language (and a publisher of up to 160 characters)." }, { status: 400 });
  if (!(file instanceof File) || !file.size || file.size > MAX_RESOURCE_BYTES) return NextResponse.json({ error: "Choose a PDF of up to 100 MB." }, { status: 413 });

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") return NextResponse.json({ error: "The file is not a PDF." }, { status: 415 });
  const title = (String(formData.get("title") ?? "").trim() || `${subject.name} ${kind === "teacher_guide" ? "Teacher Guide" : "Student Textbook"} Grade ${grade} (${language})`).slice(0, 200);

  const storageKey = randomUUID();
  await mkdir(resourceStorageDirectory(CATALOG_STORAGE_ID), { recursive: true, mode: 0o700 });
  await writeFile(catalogUploadPath(storageKey), bytes, { flag: "wx", mode: 0o600 });
  const sourceUrl = `${UPLOADED_SOURCE_PREFIX}${storageKey}`;
  try {
    await db.insert(textbookCatalog).values({
      grade,
      subjectName: subject.name,
      language,
      kind,
      title,
      publisher,
      sourceUrl,
      sourceUrlHash: sourceUrlHash(sourceUrl),
      directDownload: true,
      sizeBytes: bytes.length,
      checkStatus: "ok",
      checkedAt: new Date(),
      addedBy: session.user.id,
    });
  } catch (error) {
    await unlink(catalogUploadPath(storageKey)).catch(() => {});
    throw error;
  }
  return NextResponse.json({ success: `“${title}” is now in the catalog for every school.` }, { status: 201 });
}
