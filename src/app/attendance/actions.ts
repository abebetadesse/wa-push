"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { activityEvents, attendanceRecords, classrooms, enrollments, students } from "@/db/schema";
import { requireSchoolRole } from "@/lib/permissions";

export type AttendanceActionState = { error?: string; success?: string };
type AttendanceStatus = "present" | "absent" | "late" | "excused";
type AttendanceEntry = { studentId: string; status: AttendanceStatus; remarks: string };

function isAttendanceStatus(value: unknown): value is AttendanceStatus {
  return value === "present" || value === "absent" || value === "late" || value === "excused";
}

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function saveAttendance(
  _previous: AttendanceActionState,
  formData: FormData,
): Promise<AttendanceActionState> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const classroomId = String(formData.get("classroomId") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim();
  const rawEntries = String(formData.get("entries") ?? "");
  if (!schoolId || !classroomId || !isDate(date) || !rawEntries || rawEntries.length > 500_000) {
    return { error: "Choose a valid school, class, date, and attendance roster." };
  }

  let entries: unknown;
  try {
    entries = JSON.parse(rawEntries);
  } catch {
    return { error: "The attendance data could not be read. Reload the page and try again." };
  }
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > 2000) {
    return { error: "An attendance roster must contain between 1 and 2,000 students." };
  }
  const parsedEntries: AttendanceEntry[] = [];
  for (const entry of entries) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("studentId" in entry) ||
      typeof entry.studentId !== "string" ||
      !entry.studentId ||
      !("status" in entry) ||
      !isAttendanceStatus(entry.status) ||
      !("remarks" in entry) ||
      typeof entry.remarks !== "string" ||
      entry.remarks.length > 255
    ) return { error: "Each student needs a valid attendance status and remarks of 255 characters or fewer." };
    parsedEntries.push({ studentId: entry.studentId, status: entry.status, remarks: entry.remarks.trim() });
  }
  const uniqueStudentIds = new Set(parsedEntries.map((entry) => entry.studentId));
  if (uniqueStudentIds.size !== parsedEntries.length) {
    return { error: "The attendance roster contains duplicate students." };
  }

  const { session } = await requireSchoolRole(schoolId, ["school_admin", "teacher"]);
  const [classroom] = await db.select({ id: classrooms.id, name: classrooms.name })
    .from(classrooms)
    .where(and(eq(classrooms.id, classroomId), eq(classrooms.schoolId, schoolId)))
    .limit(1);
  if (!classroom) return { error: "The selected class does not belong to this school." };

  const activeRoster = await db.select({ studentId: students.id })
    .from(enrollments)
    .innerJoin(students, and(
      eq(enrollments.studentId, students.id),
      eq(students.schoolId, schoolId),
      eq(students.status, "active"),
    ))
    .where(and(
      eq(enrollments.schoolId, schoolId),
      eq(enrollments.classroomId, classroomId),
      eq(enrollments.status, "enrolled"),
    ));
  const eligibleStudentIds = new Set(activeRoster.map(({ studentId }) => studentId));
  if (
    activeRoster.length === 0 ||
    parsedEntries.length !== activeRoster.length ||
    parsedEntries.some(({ studentId }) => !eligibleStudentIds.has(studentId))
  ) return { error: "The class roster changed. Reload attendance and record all currently enrolled students." };

  await db.transaction(async (tx) => {
    for (const entry of parsedEntries) {
      await tx.insert(attendanceRecords).values({
        id: randomUUID(),
        schoolId,
        classroomId,
        studentId: entry.studentId,
        date,
        status: entry.status,
        remarks: entry.remarks || null,
      }).onDuplicateKeyUpdate({
        set: { status: entry.status, remarks: entry.remarks || null },
      });
    }
    await tx.insert(activityEvents).values({
      schoolId,
      userId: session.user.id,
      detail: `Recorded attendance for ${classroom.name} on ${date}`,
    });
  });

  revalidatePath("/attendance");
  revalidatePath("/reports");
  return { success: `Attendance saved for ${parsedEntries.length} students.` };
}
