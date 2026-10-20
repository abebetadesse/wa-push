"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  academicYears,
  activityEvents,
  classrooms,
  gradeLevels,
  lessonPlans,
  subjects,
} from "@/db/schema";
import { isPlatformAdmin, requireSchoolRole } from "@/lib/permissions";
import { canEditLesson, type LessonStatus } from "./lesson-access";

export type LessonActionState = { error?: string; success?: string };

export async function createLesson(
  _previous: LessonActionState,
  formData: FormData,
): Promise<LessonActionState> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const academicYearId = String(formData.get("academicYearId") ?? "").trim();
  const gradeLevelId = String(formData.get("gradeLevelId") ?? "").trim();
  const subjectId = String(formData.get("subjectId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const unitTopic = String(formData.get("unitTopic") ?? "").trim();
  const objectives = String(formData.get("objectives") ?? "").trim();
  const scheduledDate = String(formData.get("scheduledDate") ?? "").trim();

  if (!schoolId || !academicYearId || !gradeLevelId || !subjectId) {
    return { error: "Select a school, academic year, grade level, and subject." };
  }
  if (!title || title.length > 200 || unitTopic.length > 160 || objectives.length > 5000) {
    return { error: "Enter a title and keep topic and objectives within the specified limits." };
  }
  if (scheduledDate && !isDate(scheduledDate)) return { error: "Enter a valid lesson date." };
  const { session } = await requireSchoolRole(schoolId, ["school_admin", "teacher"]);

  const [year] = await db
    .select({ id: academicYears.id })
    .from(academicYears)
    .where(and(eq(academicYears.id, academicYearId), eq(academicYears.schoolId, schoolId)))
    .limit(1);
  const [grade] = await db
    .select({ id: gradeLevels.id })
    .from(gradeLevels)
    .where(and(eq(gradeLevels.id, gradeLevelId), eq(gradeLevels.schoolId, schoolId)))
    .limit(1);
  const [subject] = await db
    .select({ id: subjects.id })
    .from(subjects)
    .where(and(eq(subjects.id, subjectId), eq(subjects.schoolId, schoolId)))
    .limit(1);
  if (!year || !grade || !subject) return { error: "The selected academic setup does not belong to this school." };

  await db.transaction(async (tx) => {
    await tx.insert(lessonPlans).values({
      id: randomUUID(),
      schoolId,
      academicYearId,
      gradeLevelId,
      subjectId,
      createdBy: session.user.id,
      title,
      unitTopic: unitTopic || null,
      objectives: objectives || null,
      scheduledDate: scheduledDate || null,
    });
    await tx.insert(activityEvents).values({
      schoolId,
      userId: session.user.id,
      detail: `Created lesson plan: ${title}`,
    });
  });

  revalidatePath("/");
  revalidatePath("/lessons");
  return { success: `Lesson plan “${title}” saved as a draft.` };
}

export async function updateLessonStatus(formData: FormData): Promise<void> {
  const lessonId = String(formData.get("lessonId") ?? "").trim();
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const nextStatus = String(formData.get("status") ?? "").trim();
  if (!lessonId || !schoolId || !isLessonStatus(nextStatus)) throw new Error("Invalid lesson status request.");

  const { session, role } = await requireSchoolRole(schoolId, ["school_admin", "teacher"]);
  const [lesson] = await db
    .select({
      title: lessonPlans.title,
      status: lessonPlans.status,
      createdBy: lessonPlans.createdBy,
    })
    .from(lessonPlans)
    .where(and(eq(lessonPlans.id, lessonId), eq(lessonPlans.schoolId, schoolId)))
    .limit(1);
  if (!lesson) throw new Error("Lesson plan not found in this school.");

  const platformAdmin = isPlatformAdmin(session);
  const isTeacherOwner = role === "teacher" && lesson.createdBy === session.user.id;
  const permitted = platformAdmin ||
    (role === "school_admin" && (
      (lesson.status === "submitted" && nextStatus === "approved") ||
      (lesson.status === "submitted" && nextStatus === "draft") ||
      (lesson.status === "approved" && nextStatus === "published") ||
      nextStatus === "archived"
    )) ||
    (isTeacherOwner && lesson.status === "draft" && nextStatus === "submitted");
  if (!permitted) throw new Error("You do not have permission to make this lesson status change.");

  await db.transaction(async (tx) => {
    await tx
      .update(lessonPlans)
      .set({ status: nextStatus })
      .where(and(eq(lessonPlans.id, lessonId), eq(lessonPlans.schoolId, schoolId)));
    await tx.insert(activityEvents).values({
      schoolId,
      userId: session.user.id,
      detail: `Changed lesson “${lesson.title}” to ${nextStatus}`,
    });
  });
  revalidatePath("/");
  revalidatePath("/lessons");
  revalidatePath(`/lessons/${lessonId}`);
}

const lessonTextFields = [
  "overview",
  "objectives",
  "materials",
  "prerequisites",
  "procedures",
  "differentiation",
  "assessment",
  "homework",
  "notes",
] as const;

export async function updateLesson(
  _previous: LessonActionState,
  formData: FormData,
): Promise<LessonActionState> {
  const lessonId = String(formData.get("lessonId") ?? "").trim();
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const academicYearId = String(formData.get("academicYearId") ?? "").trim();
  const gradeLevelId = String(formData.get("gradeLevelId") ?? "").trim();
  const subjectId = String(formData.get("subjectId") ?? "").trim();
  const classroomId = String(formData.get("classroomId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const unitTopic = String(formData.get("unitTopic") ?? "").trim();
  const scheduledDate = String(formData.get("scheduledDate") ?? "").trim();
  const durationMinutes = Number(String(formData.get("durationMinutes") ?? "").trim());
  const text = Object.fromEntries(
    lessonTextFields.map((field) => [field, String(formData.get(field) ?? "").trim()]),
  ) as Record<(typeof lessonTextFields)[number], string>;

  if (!lessonId || !schoolId || !academicYearId || !gradeLevelId || !subjectId) {
    return { error: "Select an academic year, grade level, and subject." };
  }
  if (!title || title.length > 200 || unitTopic.length > 160) {
    return { error: "Enter a title of 200 characters or fewer and a topic of 160 characters or fewer." };
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 600) {
    return { error: "Duration must be a whole number of minutes between 5 and 600." };
  }
  if (scheduledDate && !isDate(scheduledDate)) return { error: "Enter a valid lesson date." };
  if (Object.values(text).some((value) => value.length > 10000)) {
    return { error: "Each lesson section must be 10,000 characters or fewer." };
  }

  const { session, role } = await requireSchoolRole(schoolId, ["school_admin", "teacher"]);
  const [lesson] = await db
    .select({ status: lessonPlans.status, createdBy: lessonPlans.createdBy })
    .from(lessonPlans)
    .where(and(eq(lessonPlans.id, lessonId), eq(lessonPlans.schoolId, schoolId)))
    .limit(1);
  if (!lesson) return { error: "Lesson plan not found in this school." };
  if (!canEditLesson({ role, userId: session.user.id, platformAdmin: isPlatformAdmin(session), ...lesson })) {
    return { error: "You cannot edit this lesson plan in its current status." };
  }

  const [year] = await db.select({ id: academicYears.id }).from(academicYears)
    .where(and(eq(academicYears.id, academicYearId), eq(academicYears.schoolId, schoolId))).limit(1);
  const [grade] = await db.select({ id: gradeLevels.id }).from(gradeLevels)
    .where(and(eq(gradeLevels.id, gradeLevelId), eq(gradeLevels.schoolId, schoolId))).limit(1);
  const [subject] = await db.select({ id: subjects.id }).from(subjects)
    .where(and(eq(subjects.id, subjectId), eq(subjects.schoolId, schoolId))).limit(1);
  if (!year || !grade || !subject) return { error: "The selected academic setup does not belong to this school." };
  if (classroomId) {
    const [classroom] = await db.select({ id: classrooms.id }).from(classrooms)
      .where(and(
        eq(classrooms.id, classroomId),
        eq(classrooms.schoolId, schoolId),
        eq(classrooms.academicYearId, academicYearId),
        eq(classrooms.gradeLevelId, gradeLevelId),
      ))
      .limit(1);
    if (!classroom) return { error: "Select a classroom in the chosen academic year and grade." };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(lessonPlans)
      .set({
        academicYearId,
        gradeLevelId,
        subjectId,
        classroomId: classroomId || null,
        title,
        unitTopic: unitTopic || null,
        durationMinutes,
        scheduledDate: scheduledDate || null,
        overview: text.overview || null,
        objectives: text.objectives || null,
        materials: text.materials || null,
        prerequisites: text.prerequisites || null,
        procedures: text.procedures || null,
        differentiation: text.differentiation || null,
        assessment: text.assessment || null,
        homework: text.homework || null,
        notes: text.notes || null,
      })
      .where(and(eq(lessonPlans.id, lessonId), eq(lessonPlans.schoolId, schoolId)));
    await tx.insert(activityEvents).values({
      schoolId,
      userId: session.user.id,
      detail: `Updated lesson plan: ${title}`,
    });
  });

  revalidatePath("/lessons");
  revalidatePath(`/lessons/${lessonId}`);
  return { success: "Lesson plan saved." };
}

function isLessonStatus(value: string): value is LessonStatus {
  return ["draft", "submitted", "approved", "published", "archived"].includes(value);
}

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
