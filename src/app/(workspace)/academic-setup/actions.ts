"use server";

import { guardAction, UserError } from "@/lib/action-result";

import { randomUUID } from "node:crypto";
import { and, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { academicYears, activityEvents, classrooms, gradeLevels, schools, subjects } from "@/db/schema";
import { requireSchoolRole } from "@/lib/permissions";
import { isDuplicateEntry } from "@/lib/db-errors";

export type AcademicSetupState = { error?: string; success?: string };

async function createAcademicYearImpl(
  _previous: AcademicSetupState,
  formData: FormData,
): Promise<AcademicSetupState> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const startsOn = String(formData.get("startsOn") ?? "").trim();
  const endsOn = String(formData.get("endsOn") ?? "").trim();
  const isCurrent = formData.get("isCurrent") === "on";
  if (name.length < 2 || name.length > 80 || !isDate(startsOn) || !isDate(endsOn) || startsOn >= endsOn) {
    return { error: "Enter an academic year name and valid dates, with the end date after the start date." };
  }

  const { session } = await requireSchoolRole(schoolId, ["school_admin"]);
  try {
    await db.transaction(async (tx) => {
      const [school] = await tx.select({ id: schools.id }).from(schools).where(eq(schools.id, schoolId)).for("update").limit(1);
      if (!school) throw new UserError("School not found.");
      if (isCurrent) {
        await tx.update(academicYears).set({ isCurrent: false }).where(eq(academicYears.schoolId, schoolId));
      }
      await tx.insert(academicYears).values({
        id: randomUUID(),
        schoolId,
        name,
        startsOn,
        endsOn,
        isCurrent,
      });
      await tx.insert(activityEvents).values({
        schoolId,
        userId: session.user.id,
        detail: `Created academic year ${name}`,
      });
    });
  } catch (error) {
    if (isDuplicateEntry(error)) return { error: "An academic year with this name already exists." };
    throw error;
  }

  revalidatePath("/academic-setup");
  revalidatePath("/lessons");
  return { success: `Academic year ${name} created.` };
}

async function createGradeLevelImpl(
  _previous: AcademicSetupState,
  formData: FormData,
): Promise<AcademicSetupState> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!schoolId || name.length < 1 || name.length > 80) return { error: "Enter a grade name." };
  const { session } = await requireSchoolRole(schoolId, ["school_admin"]);

  try {
    await db.transaction(async (tx) => {
      const [order] = await tx.select({ value: max(gradeLevels.sortOrder) }).from(gradeLevels).where(eq(gradeLevels.schoolId, schoolId));
      await tx.insert(gradeLevels).values({
        id: randomUUID(),
        schoolId,
        name,
        sortOrder: (order.value ?? 0) + 1,
      });
      await tx.insert(activityEvents).values({
        schoolId,
        userId: session.user.id,
        detail: `Added grade level ${name}`,
      });
    });
  } catch (error) {
    if (isDuplicateEntry(error)) return { error: "This grade level already exists." };
    throw error;
  }

  revalidatePath("/academic-setup");
  revalidatePath("/lessons");
  return { success: `Grade level ${name} added.` };
}

async function createSubjectImpl(
  _previous: AcademicSetupState,
  formData: FormData,
): Promise<AcademicSetupState> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  if (!schoolId || name.length < 1 || name.length > 120 || code.length > 30) {
    return { error: "Enter a subject name and a code of 30 characters or fewer." };
  }
  const { session } = await requireSchoolRole(schoolId, ["school_admin"]);

  try {
    await db.transaction(async (tx) => {
      await tx.insert(subjects).values({
        id: randomUUID(),
        schoolId,
        name,
        code: code || null,
      });
      await tx.insert(activityEvents).values({
        schoolId,
        userId: session.user.id,
        detail: `Added subject ${name}`,
      });
    });
  } catch (error) {
    if (isDuplicateEntry(error)) return { error: "This subject already exists at the school." };
    throw error;
  }

  revalidatePath("/academic-setup");
  revalidatePath("/lessons");
  return { success: `Subject ${name} added.` };
}

async function createClassroomImpl(
  _previous: AcademicSetupState,
  formData: FormData,
): Promise<AcademicSetupState> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const academicYearId = String(formData.get("academicYearId") ?? "").trim();
  const gradeLevelId = String(formData.get("gradeLevelId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const rawCapacity = String(formData.get("capacity") ?? "").trim();
  const capacity = rawCapacity ? Number(rawCapacity) : null;
  if (!schoolId || !academicYearId || !gradeLevelId || !name || name.length > 100) {
    return { error: "Select an academic year and grade and enter a classroom name." };
  }
  if (rawCapacity && (!Number.isInteger(capacity) || (capacity ?? 0) < 1 || (capacity ?? 0) > 500)) {
    return { error: "Class capacity must be between 1 and 500." };
  }

  const { session } = await requireSchoolRole(schoolId, ["school_admin"]);
  const [year] = await db.select({ id: academicYears.id }).from(academicYears)
    .where(and(eq(academicYears.id, academicYearId), eq(academicYears.schoolId, schoolId))).limit(1);
  const [grade] = await db.select({ id: gradeLevels.id }).from(gradeLevels)
    .where(and(eq(gradeLevels.id, gradeLevelId), eq(gradeLevels.schoolId, schoolId))).limit(1);
  if (!year || !grade) return { error: "The selected year or grade does not belong to this school." };

  try {
    await db.transaction(async (tx) => {
      await tx.insert(classrooms).values({
        id: randomUUID(),
        schoolId,
        academicYearId,
        gradeLevelId,
        name,
        capacity,
      });
      await tx.insert(activityEvents).values({
        schoolId,
        userId: session.user.id,
        detail: `Created classroom ${name}`,
      });
    });
  } catch (error) {
    if (isDuplicateEntry(error)) return { error: "A classroom with this name already exists for the academic year." };
    throw error;
  }

  revalidatePath("/");
  revalidatePath("/academic-setup");
  revalidatePath("/students");
  return { success: `Classroom ${name} created.` };
}

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

// Every action runs through guardAction, so a failure reaches the form as a message instead of
// a blank HTTP 500 (Next.js hides thrown messages in production).
export async function createAcademicYear(...args: Parameters<typeof createAcademicYearImpl>) {
  return guardAction(() => createAcademicYearImpl(...args));
}
export async function createGradeLevel(...args: Parameters<typeof createGradeLevelImpl>) {
  return guardAction(() => createGradeLevelImpl(...args));
}
export async function createSubject(...args: Parameters<typeof createSubjectImpl>) {
  return guardAction(() => createSubjectImpl(...args));
}
export async function createClassroom(...args: Parameters<typeof createClassroomImpl>) {
  return guardAction(() => createClassroomImpl(...args));
}
