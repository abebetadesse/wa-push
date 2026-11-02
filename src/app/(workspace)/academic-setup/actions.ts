"use server";

import { databaseErrorCode, guardAction, UserError } from "@/lib/action-result";

import { randomUUID } from "node:crypto";
import { and, count, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { academicYears, activityEvents, assessments, attendanceRecords, classrooms, enrollments, gradeLevels, schools, subjects } from "@/db/schema";
import { CURRICULUM_SUBJECTS, curriculumSubject, gradeNumber } from "@/lib/ethiopian-curriculum";
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

const SECTION_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** The current school year (September to July) when none is set: "2026/27" from Meskerem 1. */
function defaultSchoolYear(now = new Date()) {
  const year = now.getUTCFullYear();
  const newYearDay = (calendarYear: number) => ((calendarYear + 1) % 4 === 0 ? 12 : 11);
  const startYear = now >= new Date(Date.UTC(year, 8, newYearDay(year))) ? year : year - 1;
  return {
    name: `${startYear}/${String((startYear + 1) % 100).padStart(2, "0")}`,
    startsOn: `${startYear}-09-${newYearDay(startYear)}`,
    endsOn: `${startYear + 1}-07-07`,
  };
}

/**
 * Sets up a school's grades and sections in one step: "Grade 1"–"Grade 12" (or any range), each
 * with sections A–F (classrooms "1A"…"12F") in the current academic year, and optionally the
 * national curriculum's subjects for those grades. Anything that already exists is kept.
 */
async function setUpGradesAndSectionsImpl(_previous: AcademicSetupState, formData: FormData): Promise<AcademicSetupState> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const from = Number(formData.get("fromGrade"));
  const to = Number(formData.get("toGrade"));
  const sectionCount = Number(formData.get("sections"));
  const rawCapacity = String(formData.get("capacity") ?? "").trim();
  const capacity = rawCapacity ? Number(rawCapacity) : null;
  if (!schoolId || !Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > 12 || from > to) {
    return { error: "Choose a grade range within 1 to 12." };
  }
  if (!Number.isInteger(sectionCount) || sectionCount < 1 || sectionCount > 26) return { error: "Choose 1 to 26 sections per grade." };
  if (rawCapacity && (!Number.isInteger(capacity) || (capacity ?? 0) < 1 || (capacity ?? 0) > 500)) return { error: "Class capacity must be between 1 and 500." };
  const { session } = await requireSchoolRole(schoolId, ["school_admin"]);

  const counts = { grades: 0, sections: 0, subjects: 0, year: "" };
  await db.transaction(async (tx) => {
    let [year] = await tx.select({ id: academicYears.id, name: academicYears.name }).from(academicYears)
      .where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.isCurrent, true))).limit(1);
    if (!year) {
      const defaults = defaultSchoolYear();
      const [named] = await tx.select({ id: academicYears.id, name: academicYears.name }).from(academicYears)
        .where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.name, defaults.name))).limit(1);
      if (named) {
        await tx.update(academicYears).set({ isCurrent: true }).where(eq(academicYears.id, named.id));
        year = named;
      } else {
        year = { id: randomUUID(), name: defaults.name };
        await tx.insert(academicYears).values({ id: year.id, schoolId, ...defaults, isCurrent: true });
      }
      counts.year = year.name;
    }

    const existingGrades = await tx.select({ id: gradeLevels.id, name: gradeLevels.name }).from(gradeLevels).where(eq(gradeLevels.schoolId, schoolId));
    const existingRooms = new Set((await tx.select({ name: classrooms.name }).from(classrooms).where(eq(classrooms.academicYearId, year.id))).map((room) => room.name.toLowerCase()));
    for (let number = from; number <= to; number += 1) {
      let gradeId = existingGrades.find((grade) => gradeNumber(grade.name) === number)?.id;
      if (!gradeId) {
        gradeId = randomUUID();
        await tx.insert(gradeLevels).values({ id: gradeId, schoolId, name: `Grade ${number}`, sortOrder: number });
        counts.grades += 1;
      }
      for (const letter of SECTION_LETTERS.slice(0, sectionCount)) {
        const name = `${number}${letter}`;
        if (existingRooms.has(name.toLowerCase())) continue;
        await tx.insert(classrooms).values({ id: randomUUID(), schoolId, academicYearId: year.id, gradeLevelId: gradeId, name, capacity });
        existingRooms.add(name.toLowerCase());
        counts.sections += 1;
      }
    }

    if (formData.get("addSubjects") === "on") {
      const have = new Set((await tx.select({ name: subjects.name }).from(subjects).where(eq(subjects.schoolId, schoolId)))
        .map((subject) => curriculumSubject(subject.name)?.name ?? subject.name));
      for (const subject of CURRICULUM_SUBJECTS) {
        const [first, last] = subject.grades;
        if (last < from || first > to || have.has(subject.name)) continue;
        await tx.insert(subjects).values({ id: randomUUID(), schoolId, name: subject.name, code: subject.code, department: subject.department });
        counts.subjects += 1;
      }
    }
    await tx.insert(activityEvents).values({
      schoolId,
      userId: session.user.id,
      detail: `Set up grades ${from}–${to}: ${counts.grades} grades, ${counts.sections} sections, ${counts.subjects} subjects added`.slice(0, 255),
    });
  });

  revalidatePath("/");
  revalidatePath("/academic-setup");
  revalidatePath("/students");
  revalidatePath("/textbooks");
  return {
    success: `Added ${counts.grades} grade${counts.grades === 1 ? "" : "s"}, ${counts.sections} section${counts.sections === 1 ? "" : "s"} and ${counts.subjects} subject${counts.subjects === 1 ? "" : "s"}${counts.year ? ` in the new academic year ${counts.year}` : ""}. Existing ones were kept.`,
  };
}

/** Why a section can't be deleted (students, assessments or attendance would be lost), or null. */
async function sectionInUse(classroomId: string) {
  const [[enrolled], [assessed], [attended]] = await Promise.all([
    db.select({ value: count() }).from(enrollments).where(eq(enrollments.classroomId, classroomId)),
    db.select({ value: count() }).from(assessments).where(eq(assessments.classroomId, classroomId)),
    db.select({ value: count() }).from(attendanceRecords).where(eq(attendanceRecords.classroomId, classroomId)),
  ]);
  if (enrolled.value) return `${enrolled.value} student${enrolled.value === 1 ? " is" : "s are"} enrolled in it`;
  if (assessed.value) return `${assessed.value} assessment${assessed.value === 1 ? " uses" : "s use"} it`;
  if (attended.value) return "it has attendance records";
  return null;
}

async function deleteClassroomImpl(_previous: AcademicSetupState, formData: FormData): Promise<AcademicSetupState> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const classroomId = String(formData.get("classroomId") ?? "").trim();
  const { session } = await requireSchoolRole(schoolId, ["school_admin"]);
  const [room] = await db.select({ id: classrooms.id, name: classrooms.name }).from(classrooms)
    .where(and(eq(classrooms.id, classroomId), eq(classrooms.schoolId, schoolId))).limit(1);
  if (!room) return { error: "That section no longer exists." };
  const reason = await sectionInUse(room.id);
  if (reason) return { error: `Section ${room.name} can't be deleted: ${reason}. Move the students or records first.` };
  await db.transaction(async (tx) => {
    await tx.delete(classrooms).where(eq(classrooms.id, room.id));
    await tx.insert(activityEvents).values({ schoolId, userId: session.user.id, detail: `Deleted section ${room.name}` });
  });
  revalidatePath("/academic-setup");
  revalidatePath("/students");
  return { success: `Section ${room.name} was deleted.` };
}

async function deleteGradeLevelImpl(_previous: AcademicSetupState, formData: FormData): Promise<AcademicSetupState> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const gradeLevelId = String(formData.get("gradeLevelId") ?? "").trim();
  const { session } = await requireSchoolRole(schoolId, ["school_admin"]);
  const [grade] = await db.select({ id: gradeLevels.id, name: gradeLevels.name }).from(gradeLevels)
    .where(and(eq(gradeLevels.id, gradeLevelId), eq(gradeLevels.schoolId, schoolId))).limit(1);
  if (!grade) return { error: "That grade no longer exists." };
  const rooms = await db.select({ id: classrooms.id, name: classrooms.name }).from(classrooms).where(eq(classrooms.gradeLevelId, grade.id));
  for (const room of rooms) {
    const reason = await sectionInUse(room.id);
    if (reason) return { error: `${grade.name} can't be deleted: in section ${room.name}, ${reason}.` };
  }
  try {
    await db.transaction(async (tx) => {
      if (rooms.length) await tx.delete(classrooms).where(eq(classrooms.gradeLevelId, grade.id));
      await tx.delete(gradeLevels).where(eq(gradeLevels.id, grade.id));
      await tx.insert(activityEvents).values({ schoolId, userId: session.user.id, detail: `Deleted ${grade.name} and its ${rooms.length} sections` });
    });
  } catch (error) {
    if (databaseErrorCode(error) === "ER_ROW_IS_REFERENCED_2") return { error: `${grade.name} is still used by lesson plans. Move or delete them first.` };
    throw error;
  }
  revalidatePath("/academic-setup");
  revalidatePath("/textbooks");
  return { success: `${grade.name} and its ${rooms.length} section${rooms.length === 1 ? "" : "s"} were deleted.` };
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
export async function setUpGradesAndSections(...args: Parameters<typeof setUpGradesAndSectionsImpl>) {
  return guardAction(() => setUpGradesAndSectionsImpl(...args));
}
export async function deleteClassroom(...args: Parameters<typeof deleteClassroomImpl>) {
  return guardAction(() => deleteClassroomImpl(...args));
}
export async function deleteGradeLevel(...args: Parameters<typeof deleteGradeLevelImpl>) {
  return guardAction(() => deleteGradeLevelImpl(...args));
}
