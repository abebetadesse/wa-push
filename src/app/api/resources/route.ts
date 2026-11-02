import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { activityEvents, gradeLevels, learningResources, subjects } from "@/db/schema";
import { canManageLearningResources, MAX_RESOURCE_BYTES, resourceFileType, resourceStorageDirectory } from "@/lib/learning-resources";
import { getSession, isPlatformAdmin } from "@/lib/permissions";

const MAX_REQUEST_BYTES = MAX_RESOURCE_BYTES + 1024 * 1024;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to upload learning resources." }, { status: 401 });

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "Resource uploads are limited to 100 MB." }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "The upload request could not be read. Choose a file and try again." }, { status: 400 });
  }

  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const titleInput = String(formData.get("title") ?? "").trim();
  const kind = String(formData.get("kind") ?? "").trim();
  const descriptionInput = String(formData.get("description") ?? "").trim();
  // Textbooks and teacher guides uploaded from the Textbooks page say so, before any description.
  const description = kind === "teacher_guide" ? `Teacher guide.${descriptionInput ? ` ${descriptionInput}` : ""}`
    : kind === "student_textbook" ? `Student textbook.${descriptionInput ? ` ${descriptionInput}` : ""}` : descriptionInput;
  const gradeLevelInput = String(formData.get("gradeLevelId") ?? "").trim();
  const subjectInput = String(formData.get("subjectId") ?? "").trim();
  const uploadedFile = formData.get("file");
  if (!schoolId || !(uploadedFile instanceof File) || !uploadedFile.name) {
    return NextResponse.json({ error: "Choose a school and a resource file." }, { status: 400 });
  }
  if (!(await canManageLearningResources(schoolId, session.user.id, isPlatformAdmin(session)))) {
    return NextResponse.json({ error: "You do not have permission to upload resources to this school." }, { status: 403 });
  }
  if (!uploadedFile.size || uploadedFile.size > MAX_RESOURCE_BYTES) {
    return NextResponse.json({ error: "Choose a non-empty file no larger than 100 MB." }, { status: 413 });
  }
  if (description.length > 2000 || titleInput.length > 200) {
    return NextResponse.json({ error: "Keep the title under 200 characters and description under 2,000 characters." }, { status: 400 });
  }

  // A grade and subject must be the school's own.
  const [gradeLevel] = gradeLevelInput
    ? await db.select({ id: gradeLevels.id }).from(gradeLevels).where(and(eq(gradeLevels.id, gradeLevelInput), eq(gradeLevels.schoolId, schoolId))).limit(1)
    : [];
  const [subject] = subjectInput
    ? await db.select({ id: subjects.id }).from(subjects).where(and(eq(subjects.id, subjectInput), eq(subjects.schoolId, schoolId))).limit(1)
    : [];
  if ((gradeLevelInput && !gradeLevel) || (subjectInput && !subject)) {
    return NextResponse.json({ error: "Choose a grade and subject of this school." }, { status: 400 });
  }

  const fileName = basename(uploadedFile.name.replace(/\\/g, "/"))
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .slice(0, 255);
  const fileType = resourceFileType(fileName);
  if (!fileType) {
    return NextResponse.json({ error: "This file type is not supported. Upload a document, text, image, audio, video, animation, or archive file." }, { status: 415 });
  }

  const title = (titleInput || basename(fileName, extname(fileName)) || fileName).slice(0, 200);
  const storageKey = randomUUID();
  const filePath = join(resourceStorageDirectory(schoolId), storageKey);
  await mkdir(resourceStorageDirectory(schoolId), { recursive: true, mode: 0o700 });
  await writeFile(filePath, Buffer.from(await uploadedFile.arrayBuffer()), { flag: "wx", mode: 0o600 });

  try {
    await db.transaction(async (tx) => {
      await tx.insert(learningResources).values({
        id: randomUUID(),
        schoolId,
        uploadedBy: session.user.id,
        gradeLevelId: gradeLevel?.id ?? null,
        subjectId: subject?.id ?? null,
        title,
        description: description || null,
        fileName,
        storageKey,
        contentType: fileType.contentType,
        sizeBytes: uploadedFile.size,
      });
      await tx.insert(activityEvents).values({
        schoolId,
        userId: session.user.id,
        detail: `Uploaded learning resource: ${title}`,
      });
    });
  } catch (error) {
    await unlink(filePath);
    throw error;
  }

  return NextResponse.json({ success: `“${title}” was added to the resource library.` }, { status: 201 });
}
