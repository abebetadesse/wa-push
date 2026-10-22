"use server";

import { guardAction, UserError } from "@/lib/action-result";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  academicYears,
  activityEvents,
  classrooms,
  classSchedules,
  gradeLevels,
  lessonPlanRevisions,
  lessonPlans,
  subjects,
} from "@/db/schema";
import { isPlatformAdmin, requireSchoolRole } from "@/lib/permissions";
import {
  generateCurriculumLessonPlans,
  type GeneratedLessonPlan,
} from "@/lib/lesson-generator";

export type GeneratePreviewState = {
  error?: string;
  success?: string;
  plans?: GeneratedLessonPlan[];
};

export type BatchSaveState = {
  error?: string;
  success?: string;
  savedCount?: number;
};

/**
 * Generates an interactive preview of lesson plans without saving them yet.
 */
async function previewLessonPlansImpl(formData: FormData): Promise<GeneratePreviewState> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const academicYearId = String(formData.get("academicYearId") ?? "").trim();
  const gradeLevelId = String(formData.get("gradeLevelId") ?? "").trim();
  const subjectId = String(formData.get("subjectId") ?? "").trim();
  const classroomId = String(formData.get("classroomId") ?? "").trim() || undefined;
  const teacherId = String(formData.get("teacherId") ?? "").trim() || undefined;
  const resourceId = String(formData.get("resourceId") ?? "").trim() || undefined;
  const customText = String(formData.get("customText") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "").trim() || new Date().toISOString().slice(0, 10);

  if (!schoolId || !academicYearId || !gradeLevelId || !subjectId) {
    return { error: "Please select School, Academic Year, Grade Level, and Subject." };
  }

  await requireSchoolRole(schoolId, ["school_admin", "teacher"]);

  const [grade] = await db
    .select({ name: gradeLevels.name })
    .from(gradeLevels)
    .where(and(eq(gradeLevels.id, gradeLevelId), eq(gradeLevels.schoolId, schoolId)))
    .limit(1);

  const [subject] = await db
    .select({ name: subjects.name })
    .from(subjects)
    .where(and(eq(subjects.id, subjectId), eq(subjects.schoolId, schoolId)))
    .limit(1);

  if (!grade || !subject) {
    return { error: "Selected grade or subject was not found in this school." };
  }

  const generated = await generateCurriculumLessonPlans({
    schoolId,
    academicYearId,
    gradeLevelId,
    subjectId,
    classroomId,
    teacherId,
    resourceId,
    customText,
    startDate,
    subjectName: subject.name,
    gradeName: grade.name,
  });

  if (generated.length === 0) {
    return { error: "No curriculum units or topics could be parsed from the provided resource or text." };
  }

  return {
    success: `Generated ${generated.length} structured lesson plans ready for editing and approval.`,
    plans: generated,
  };
}

/**
 * Batch saves generated (and optionally edited) lesson plans into the database with revision tracking.
 */
async function batchSaveLessonPlansImpl(formData: FormData): Promise<BatchSaveState> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const academicYearId = String(formData.get("academicYearId") ?? "").trim();
  const gradeLevelId = String(formData.get("gradeLevelId") ?? "").trim();
  const subjectId = String(formData.get("subjectId") ?? "").trim();
  const classroomId = String(formData.get("classroomId") ?? "").trim() || null;
  const teacherId = String(formData.get("teacherId") ?? "").trim() || null;
  const sourceResourceId = String(formData.get("sourceResourceId") ?? "").trim() || null;
  const requestedStatus = String(formData.get("initialStatus") ?? "draft").trim();
  const rawPlansJson = String(formData.get("plansJson") ?? "[]").trim();

  if (!schoolId || !academicYearId || !gradeLevelId || !subjectId) {
    return { error: "Missing required school academic configuration." };
  }

  let plans: GeneratedLessonPlan[] = [];
  try {
    plans = JSON.parse(rawPlansJson);
  } catch {
    return { error: "Invalid lesson plans payload." };
  }

  if (!Array.isArray(plans) || plans.length === 0) {
    return { error: "No lesson plans provided to save." };
  }

  const { session, role } = await requireSchoolRole(schoolId, ["school_admin", "teacher"]);
  const platformAdmin = isPlatformAdmin(session);
  const canApprove = platformAdmin || role === "school_admin";

  // Determine starting status
  let initialStatus: "draft" | "submitted" | "approved" = "draft";
  if (requestedStatus === "approved" && canApprove) {
    initialStatus = "approved";
  } else if (requestedStatus === "submitted") {
    initialStatus = "submitted";
  }

  const [subject] = await db
    .select({ name: subjects.name })
    .from(subjects)
    .where(and(eq(subjects.id, subjectId), eq(subjects.schoolId, schoolId)))
    .limit(1);

  await db.transaction(async (tx) => {
    for (const plan of plans) {
      const planId = randomUUID();

      await tx.insert(lessonPlans).values({
        id: planId,
        schoolId,
        createdBy: session.user.id,
        academicYearId,
        gradeLevelId,
        subjectId,
        classroomId,
        teacherId,
        sourceResourceId,
        title: plan.title,
        unitTopic: plan.unitTopic || null,
        durationMinutes: plan.durationMinutes || 45,
        scheduledDate: plan.scheduledDate || null,
        status: initialStatus,
        overview: plan.overview || null,
        objectives: plan.objectives || null,
        materials: plan.materials || null,
        prerequisites: plan.prerequisites || null,
        procedures: plan.procedures || null,
        differentiation: plan.differentiation || null,
        assessment: plan.assessment || null,
        homework: plan.homework || null,
        notes: plan.notes || null,
      });

      // Version 1 snapshot in revision history for future enhancement
      await tx.insert(lessonPlanRevisions).values({
        id: randomUUID(),
        schoolId,
        lessonPlanId: planId,
        version: 1,
        editedBy: session.user.id,
        changeSummary: sourceResourceId
          ? "Auto-generated from uploaded learning resource / textbook"
          : "Auto-generated from curriculum units & timetable outline",
        title: plan.title,
        unitTopic: plan.unitTopic || null,
        durationMinutes: plan.durationMinutes || 45,
        scheduledDate: plan.scheduledDate || null,
        status: initialStatus,
        overview: plan.overview || null,
        objectives: plan.objectives || null,
        materials: plan.materials || null,
        prerequisites: plan.prerequisites || null,
        procedures: plan.procedures || null,
        differentiation: plan.differentiation || null,
        assessment: plan.assessment || null,
        homework: plan.homework || null,
        notes: plan.notes || null,
      });

      // Link to class schedule slot if applicable
      if (plan.scheduleId) {
        await tx
          .update(classSchedules)
          .set({ lessonPlanId: planId })
          .where(and(eq(classSchedules.id, plan.scheduleId), eq(classSchedules.schoolId, schoolId)));
      }
    }

    await tx.insert(activityEvents).values({
      schoolId,
      userId: session.user.id,
      detail: `Generated and saved ${plans.length} lesson plans for ${subject?.name ?? "Subject"} (Status: ${initialStatus})`,
    });
  });

  revalidatePath("/");
  revalidatePath("/lessons");
  revalidatePath("/timetable");

  return {
    success: `Successfully created and saved ${plans.length} lesson plans as ${initialStatus}. They are immediately available for review and future enhancement.`,
    savedCount: plans.length,
  };
}

/**
 * Batch approves a set of submitted lesson plans (School Admin / Platform Admin only).
 */
async function batchApproveLessonPlansImpl(formData: FormData): Promise<{ error?: string; success?: string }> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const rawIds = String(formData.get("lessonIds") ?? "[]").trim();

  let lessonIds: string[] = [];
  try {
    lessonIds = JSON.parse(rawIds);
  } catch {
    return { error: "Invalid lesson IDs." };
  }

  if (!schoolId || lessonIds.length === 0) {
    return { error: "No lesson plans selected for approval." };
  }

  const { session, role } = await requireSchoolRole(schoolId, ["school_admin"]);
  const platformAdmin = isPlatformAdmin(session);
  if (!platformAdmin && role !== "school_admin") {
    throw new UserError("Only school administrators can batch approve lesson plans.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(lessonPlans)
      .set({ status: "approved" })
      .where(and(eq(lessonPlans.schoolId, schoolId), inArray(lessonPlans.id, lessonIds)));

    for (const id of lessonIds) {
      const [rev] = await tx
        .select({ maxVer: sql<number>`COALESCE(MAX(${lessonPlanRevisions.version}), 0)` })
        .from(lessonPlanRevisions)
        .where(eq(lessonPlanRevisions.lessonPlanId, id));

      const nextVer = Number(rev?.maxVer ?? 0) + 1;
      const [current] = await tx.select().from(lessonPlans).where(eq(lessonPlans.id, id)).limit(1);

      if (current) {
        await tx.insert(lessonPlanRevisions).values({
          id: randomUUID(),
          schoolId,
          lessonPlanId: id,
          version: nextVer,
          editedBy: session.user.id,
          changeSummary: "Approved by school administrator",
          title: current.title,
          unitTopic: current.unitTopic,
          durationMinutes: current.durationMinutes,
          scheduledDate: current.scheduledDate,
          status: "approved",
          overview: current.overview,
          objectives: current.objectives,
          materials: current.materials,
          prerequisites: current.prerequisites,
          procedures: current.procedures,
          differentiation: current.differentiation,
          assessment: current.assessment,
          homework: current.homework,
          notes: current.notes,
        });
      }
    }

    await tx.insert(activityEvents).values({
      schoolId,
      userId: session.user.id,
      detail: `Batch approved ${lessonIds.length} lesson plans`,
    });
  });

  revalidatePath("/lessons");
  revalidatePath("/");
  return { success: `Successfully approved ${lessonIds.length} lesson plans.` };
}

export async function previewLessonPlans(formData: FormData) {
  return guardAction(() => previewLessonPlansImpl(formData));
}

export async function batchSaveLessonPlans(formData: FormData) {
  return guardAction(() => batchSaveLessonPlansImpl(formData));
}

export async function batchApproveLessonPlans(formData: FormData) {
  return guardAction(() => batchApproveLessonPlansImpl(formData));
}
