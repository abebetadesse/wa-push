"use server";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { activityEvents, teachers, teacherReports } from "@/db/schema";
import { guardAction, UserError, type ActionState } from "@/lib/action-result";
import { resourceStorageDirectory } from "@/lib/learning-resources";
import { isPlatformAdmin, requireSchoolRole } from "@/lib/permissions";
import { detectImageType, MAX_PR_IMAGE_BYTES } from "@/lib/pr-media";
import type { ReportSection } from "@/lib/transcription";

export type PhotoReportActionState = ActionState & {
  reportId?: string;
};

async function submitPhotoReportImpl(
  _previous: PhotoReportActionState,
  formData: FormData,
): Promise<PhotoReportActionState> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const section = (String(formData.get("section") ?? "general").trim() || "general") as ReportSection;
  const reportDate = String(formData.get("reportDate") ?? "").trim() || new Date().toISOString().slice(0, 10);
  const transcription = String(formData.get("transcription") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const classroomId = String(formData.get("classroomId") ?? "").trim() || null;
  const subjectId = String(formData.get("subjectId") ?? "").trim() || null;
  const academicYearId = String(formData.get("academicYearId") ?? "").trim() || null;
  const lessonPlanId = String(formData.get("lessonPlanId") ?? "").trim() || null;
  const assessmentId = String(formData.get("assessmentId") ?? "").trim() || null;

  if (!schoolId) throw new UserError("Select a school.");
  if (!title) throw new UserError("Please enter a title for the report.");
  if (!["lessons", "attendance", "assessments", "facilities", "general"].includes(section)) {
    throw new UserError("Invalid target section.");
  }

  const { session } = await requireSchoolRole(schoolId, [
    "school_admin",
    "teacher",
    "lab_technician",
    "workshop_manager",
    "hr_manager",
    "inventory_manager",
    "pr_officer",
    "community_officer",
  ]);

  // Find linked teacher profile if available
  const [teacher] = await db
    .select({ id: teachers.id })
    .from(teachers)
    .where(and(eq(teachers.schoolId, schoolId), eq(teachers.userId, session.user.id)))
    .limit(1);

  // Read image: Either from raw File or base64 data string (camera capture)
  let bytes: Uint8Array;
  let originalName = "camera-report.jpg";
  const rawBase64 = String(formData.get("photoData") ?? "").trim();
  const rawFile = formData.get("photo");

  if (rawBase64) {
    const cleanBase64 = rawBase64.includes(",") ? rawBase64.split(",")[1] : rawBase64;
    bytes = new Uint8Array(Buffer.from(cleanBase64, "base64"));
  } else if (rawFile instanceof File && rawFile.size > 0) {
    if (rawFile.size > MAX_PR_IMAGE_BYTES) throw new UserError("Photos must be at most 8 MB.");
    bytes = new Uint8Array(await rawFile.arrayBuffer());
    originalName = rawFile.name || originalName;
  } else {
    throw new UserError("Please capture or upload a report photo.");
  }

  if (bytes.byteLength === 0) throw new UserError("Empty photo provided.");
  if (bytes.byteLength > MAX_PR_IMAGE_BYTES) throw new UserError("Photo must be at most 8 MB.");

  const imageType = detectImageType(bytes);
  if (!imageType) throw new UserError("Please provide a valid JPEG, PNG or WebP image.");

  const storageKey = randomUUID();
  const directory = resourceStorageDirectory(schoolId);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const filePath = join(directory, storageKey);

  await writeFile(filePath, bytes, { flag: "wx", mode: 0o600 });

  const reportId = randomUUID();
  const safeFileName = `${originalName.replace(/[^\w.\- ]+/g, "").slice(0, 180) || "report"}`.replace(/\.[^.]*$/, "") + imageType.extension;
  const transcriptionStatus = transcription ? "completed" : "skipped";

  try {
    await db.insert(teacherReports).values({
      id: reportId,
      schoolId,
      teacherId: teacher?.id ?? null,
      submittedBy: session.user.id,
      title,
      section,
      reportDate,
      photoStorageKey: storageKey,
      photoFileName: safeFileName,
      photoContentType: imageType.contentType,
      photoSizeBytes: bytes.byteLength,
      transcription: transcription || null,
      transcriptionStatus,
      notes: notes || null,
      classroomId,
      subjectId,
      academicYearId,
      lessonPlanId,
      assessmentId,
      status: "submitted",
    });

    const sectionLabel = section.charAt(0).toUpperCase() + section.slice(1);
    await db.insert(activityEvents).values({
      id: randomUUID(),
      schoolId,
      userId: session.user.id,
      detail: `submitted a photo report for ${sectionLabel}: "${title}"`,
    });
  } catch (error) {
    await unlink(filePath).catch(() => {});
    console.error("[submitPhotoReport] DB insert failed:", error);
    throw new UserError("Could not save the report. Please try again.");
  }

  revalidatePath("/reports");
  revalidatePath("/lessons");
  revalidatePath("/attendance");
  revalidatePath("/assessments");
  revalidatePath("/");

  return {
    success: `Photo report "${title}" has been successfully submitted to ${section}!`,
    reportId,
  };
}

async function reviewPhotoReportImpl(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const reportId = String(formData.get("reportId") ?? "").trim();
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const status = String(formData.get("status") ?? "reviewed").trim() as "submitted" | "reviewed" | "archived";
  const feedback = String(formData.get("reviewFeedback") ?? "").trim() || null;

  if (!reportId || !schoolId) throw new UserError("Missing report information.");
  const { session } = await requireSchoolRole(schoolId, ["school_admin"]);

  await db
    .update(teacherReports)
    .set({
      status,
      reviewFeedback: feedback,
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
    })
    .where(and(eq(teacherReports.id, reportId), eq(teacherReports.schoolId, schoolId)));

  revalidatePath("/reports");
  return { success: "Report status updated." };
}

async function deletePhotoReportImpl(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const reportId = String(formData.get("reportId") ?? "").trim();
  const schoolId = String(formData.get("schoolId") ?? "").trim();

  if (!reportId || !schoolId) throw new UserError("Missing report information.");
  const { session } = await requireSchoolRole(schoolId);

  const [report] = await db
    .select({
      id: teacherReports.id,
      submittedBy: teacherReports.submittedBy,
      photoStorageKey: teacherReports.photoStorageKey,
    })
    .from(teacherReports)
    .where(and(eq(teacherReports.id, reportId), eq(teacherReports.schoolId, schoolId)))
    .limit(1);

  if (!report) throw new UserError("Report not found.");

  // Allow either the author or a school admin / platform admin to delete
  const isAuthor = report.submittedBy === session.user.id;
  if (!isAuthor && !isPlatformAdmin(session)) {
    await requireSchoolRole(schoolId, ["school_admin"]);
  }

  await db.delete(teacherReports).where(eq(teacherReports.id, reportId));

  try {
    const filePath = join(resourceStorageDirectory(schoolId), report.photoStorageKey);
    await unlink(filePath).catch(() => {});
  } catch {
    // Ignore file unlink error if file already removed
  }

  revalidatePath("/reports");
  revalidatePath("/lessons");
  revalidatePath("/attendance");
  revalidatePath("/assessments");
  return { success: "Report deleted." };
}

// Every action runs through guardAction, so a failure reaches the form as a message instead of
// an unhandled exception. Next.js's redirect() and notFound() are still rethrown correctly.
export async function submitPhotoReport(previous: PhotoReportActionState, formData: FormData) {
  return guardAction(() => submitPhotoReportImpl(previous, formData));
}
export async function reviewPhotoReport(previous: ActionState, formData: FormData) {
  return guardAction(() => reviewPhotoReportImpl(previous, formData));
}
export async function deletePhotoReport(previous: ActionState, formData: FormData) {
  return guardAction(() => deletePhotoReportImpl(previous, formData));
}
