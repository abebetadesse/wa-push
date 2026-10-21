"use server";

import { guardAction, UserError, type ActionState } from "@/lib/action-result";

import { randomUUID } from "node:crypto";
import { and, eq, gt, lt, ne, type SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { activityEvents, classSchedules, classrooms, subjects, teachers } from "@/db/schema";
import { requireSchoolRole } from "@/lib/permissions";
import { dayLabels, isDayOfWeek, type DayOfWeek } from "./days";

export type TimetableActionState = { error?: string; success?: string };

function isTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

type Slot = {
  schoolId: string;
  academicYearId: string;
  classroomId: string;
  classroomName: string;
  teacherId: string | null;
  roomNumber: string | null;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  excludeEntryId?: string;
};

// Returns a message describing the first class, teacher, or room double-booking for the slot, if any.
async function findClash(slot: Slot) {
  const overlapping = and(
    eq(classSchedules.schoolId, slot.schoolId),
    eq(classSchedules.academicYearId, slot.academicYearId),
    eq(classSchedules.dayOfWeek, slot.dayOfWeek),
    ne(classSchedules.status, "cancelled"),
    lt(classSchedules.startTime, slot.endTime),
    gt(classSchedules.endTime, slot.startTime),
    slot.excludeEntryId ? ne(classSchedules.id, slot.excludeEntryId) : undefined,
  );
  const firstClash = async (condition: SQL) => {
    const [clash] = await db
      .select({ startTime: classSchedules.startTime, endTime: classSchedules.endTime })
      .from(classSchedules)
      .where(and(overlapping, condition))
      .limit(1);
    return clash ? `from ${clash.startTime} to ${clash.endTime} on ${dayLabels[slot.dayOfWeek]}` : null;
  };

  const classClash = await firstClash(eq(classSchedules.classroomId, slot.classroomId));
  if (classClash) return `${slot.classroomName} already has a period ${classClash}.`;
  if (slot.teacherId) {
    const teacherClash = await firstClash(eq(classSchedules.teacherId, slot.teacherId));
    if (teacherClash) return `That teacher is already teaching ${teacherClash}.`;
  }
  if (slot.roomNumber) {
    const roomClash = await firstClash(eq(classSchedules.roomNumber, slot.roomNumber));
    if (roomClash) return `Room ${slot.roomNumber} is already booked ${roomClash}.`;
  }
  return null;
}

async function findAssignableTeacher(schoolId: string, teacherId: string) {
  if (!teacherId) return { teacher: null };
  const [teacher] = await db
    .select({ id: teachers.id, firstName: teachers.firstName, lastName: teachers.lastName, status: teachers.status })
    .from(teachers)
    .where(and(eq(teachers.id, teacherId), eq(teachers.schoolId, schoolId)))
    .limit(1);
  if (!teacher) return { error: "The selected teacher does not belong to this school." };
  if (teacher.status !== "active") return { error: `${teacher.firstName} ${teacher.lastName} is not active and cannot be scheduled.` };
  return { teacher };
}

async function createScheduleEntryImpl(
  _previous: TimetableActionState,
  formData: FormData,
): Promise<TimetableActionState> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const classroomId = String(formData.get("classroomId") ?? "").trim();
  const subjectId = String(formData.get("subjectId") ?? "").trim();
  const teacherId = String(formData.get("teacherId") ?? "").trim();
  const dayOfWeek = String(formData.get("dayOfWeek") ?? "").trim();
  const startTime = String(formData.get("startTime") ?? "").trim();
  const endTime = String(formData.get("endTime") ?? "").trim();
  const roomNumber = String(formData.get("roomNumber") ?? "").trim();

  if (!schoolId || !classroomId || !subjectId) return { error: "Select a class and subject." };
  if (!isDayOfWeek(dayOfWeek)) return { error: "Select a day of the week." };
  if (!isTime(startTime) || !isTime(endTime) || startTime >= endTime) {
    return { error: "Enter a start time that is earlier than the end time." };
  }
  if (roomNumber.length > 50) return { error: "Room must be 50 characters or fewer." };

  const { session } = await requireSchoolRole(schoolId, ["school_admin"]);
  const [classroom] = await db
    .select({ id: classrooms.id, name: classrooms.name, academicYearId: classrooms.academicYearId })
    .from(classrooms)
    .where(and(eq(classrooms.id, classroomId), eq(classrooms.schoolId, schoolId)))
    .limit(1);
  const [subject] = await db
    .select({ id: subjects.id, name: subjects.name })
    .from(subjects)
    .where(and(eq(subjects.id, subjectId), eq(subjects.schoolId, schoolId)))
    .limit(1);
  if (!classroom || !subject) return { error: "The selected class or subject does not belong to this school." };
  const { teacher, error } = await findAssignableTeacher(schoolId, teacherId);
  if (error) return { error };

  const clash = await findClash({
    schoolId,
    academicYearId: classroom.academicYearId,
    classroomId,
    classroomName: classroom.name,
    teacherId: teacher?.id ?? null,
    roomNumber: roomNumber || null,
    dayOfWeek,
    startTime,
    endTime,
  });
  if (clash) return { error: clash };

  await db.transaction(async (tx) => {
    await tx.insert(classSchedules).values({
      id: randomUUID(),
      schoolId,
      academicYearId: classroom.academicYearId,
      classroomId,
      subjectId,
      teacherId: teacher?.id ?? null,
      dayOfWeek,
      startTime,
      endTime,
      roomNumber: roomNumber || null,
    });
    await tx.insert(activityEvents).values({
      schoolId,
      userId: session.user.id,
      detail: `Scheduled ${subject.name} for ${classroom.name} on ${dayLabels[dayOfWeek]} ${startTime}`,
    });
  });
  revalidatePath("/timetable");
  revalidatePath("/teachers");
  return { success: `${subject.name} added on ${dayLabels[dayOfWeek]} at ${startTime}.` };
}

async function loadEntry(formData: FormData) {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const entryId = String(formData.get("entryId") ?? "").trim();
  if (!schoolId || !entryId) throw new UserError("Invalid timetable request.");
  const { session } = await requireSchoolRole(schoolId, ["school_admin"]);
  const [entry] = await db
    .select({
      id: classSchedules.id,
      academicYearId: classSchedules.academicYearId,
      classroomId: classSchedules.classroomId,
      teacherId: classSchedules.teacherId,
      roomNumber: classSchedules.roomNumber,
      status: classSchedules.status,
      dayOfWeek: classSchedules.dayOfWeek,
      startTime: classSchedules.startTime,
      endTime: classSchedules.endTime,
      classroomName: classrooms.name,
      subjectName: subjects.name,
    })
    .from(classSchedules)
    .innerJoin(classrooms, eq(classSchedules.classroomId, classrooms.id))
    .innerJoin(subjects, eq(classSchedules.subjectId, subjects.id))
    .where(and(eq(classSchedules.id, entryId), eq(classSchedules.schoolId, schoolId)))
    .limit(1);
  if (!entry) throw new UserError("Timetable entry not found in this school.");
  return { schoolId, session, entry };
}

async function toggleScheduleCancelledImpl(
  _previous: TimetableActionState,
  formData: FormData,
): Promise<TimetableActionState> {
  const { schoolId, session, entry } = await loadEntry(formData);
  const status = entry.status === "cancelled" ? "scheduled" : "cancelled";
  if (status === "scheduled") {
    // The slot may have been reused while this period was cancelled.
    const clash = await findClash({ ...entry, schoolId, excludeEntryId: entry.id });
    if (clash) return { error: `Cannot restore: ${clash}` };
  }
  await db.transaction(async (tx) => {
    await tx.update(classSchedules)
      .set({ status })
      .where(and(eq(classSchedules.id, entry.id), eq(classSchedules.schoolId, schoolId)));
    await tx.insert(activityEvents).values({
      schoolId,
      userId: session.user.id,
      detail: `${status === "cancelled" ? "Cancelled" : "Restored"} ${entry.subjectName} for ${entry.classroomName} on ${dayLabels[entry.dayOfWeek]} ${entry.startTime}`,
    });
  });
  revalidatePath("/timetable");
  revalidatePath("/teachers");
  return {};
}

async function assignScheduleTeacherImpl(
  _previous: TimetableActionState,
  formData: FormData,
): Promise<TimetableActionState> {
  const { schoolId, session, entry } = await loadEntry(formData);
  const teacherId = String(formData.get("teacherId") ?? "").trim();
  const { teacher, error } = await findAssignableTeacher(schoolId, teacherId);
  if (error) return { error };
  if ((teacher?.id ?? null) === entry.teacherId) return {};
  if (teacher && entry.status !== "cancelled") {
    const clash = await findClash({ ...entry, teacherId: teacher.id, schoolId, excludeEntryId: entry.id });
    if (clash) return { error: clash };
  }
  await db.transaction(async (tx) => {
    await tx.update(classSchedules)
      .set({ teacherId: teacher?.id ?? null })
      .where(and(eq(classSchedules.id, entry.id), eq(classSchedules.schoolId, schoolId)));
    await tx.insert(activityEvents).values({
      schoolId,
      userId: session.user.id,
      detail: teacher
        ? `Assigned ${teacher.firstName} ${teacher.lastName} to ${entry.subjectName} for ${entry.classroomName} on ${dayLabels[entry.dayOfWeek]} ${entry.startTime}`
        : `Removed the teacher from ${entry.subjectName} for ${entry.classroomName} on ${dayLabels[entry.dayOfWeek]} ${entry.startTime}`,
    });
  });
  revalidatePath("/timetable");
  revalidatePath("/teachers");
  return {};
}

async function deleteScheduleEntryImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { schoolId, session, entry } = await loadEntry(formData);
  await db.transaction(async (tx) => {
    await tx.delete(classSchedules)
      .where(and(eq(classSchedules.id, entry.id), eq(classSchedules.schoolId, schoolId)));
    await tx.insert(activityEvents).values({
      schoolId,
      userId: session.user.id,
      detail: `Removed ${entry.subjectName} for ${entry.classroomName} on ${dayLabels[entry.dayOfWeek]} ${entry.startTime} from the timetable`,
    });
  });
  revalidatePath("/timetable");
  revalidatePath("/teachers");
  return {};
}

// Every action runs through guardAction, so a failure reaches the form as a message instead of
// a blank HTTP 500 (Next.js hides thrown messages in production).
export async function createScheduleEntry(...args: Parameters<typeof createScheduleEntryImpl>) {
  return guardAction(() => createScheduleEntryImpl(...args));
}
export async function toggleScheduleCancelled(...args: Parameters<typeof toggleScheduleCancelledImpl>) {
  return guardAction(() => toggleScheduleCancelledImpl(...args));
}
export async function assignScheduleTeacher(...args: Parameters<typeof assignScheduleTeacherImpl>) {
  return guardAction(() => assignScheduleTeacherImpl(...args));
}
export async function deleteScheduleEntry(...args: Parameters<typeof deleteScheduleEntryImpl>) {
  return guardAction(() => deleteScheduleEntryImpl(...args));
}
