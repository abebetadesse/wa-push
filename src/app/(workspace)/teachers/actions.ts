"use server";

import { randomUUID } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { activityEvents, authUsers, schoolMemberships, teachers } from "@/db/schema";
import { requireSchoolRole } from "@/lib/permissions";
import { isDuplicateEntry } from "@/lib/db-errors";

export type TeacherActionState = { error?: string; success?: string };
type TeacherStatus = "active" | "on_leave" | "inactive";

function isTeacherStatus(value: string): value is TeacherStatus {
  return ["active", "on_leave", "inactive"].includes(value);
}

function readTeacherFields(formData: FormData) {
  const fields = {
    schoolId: String(formData.get("schoolId") ?? "").trim(),
    teacherNumber: String(formData.get("teacherNumber") ?? "").trim(),
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    phone: String(formData.get("phone") ?? "").trim(),
    specialization: String(formData.get("specialization") ?? "").trim(),
  };
  let error: string | undefined;
  if (!fields.schoolId || !fields.teacherNumber || fields.teacherNumber.length > 80) {
    error = "Enter a teacher number of 80 characters or fewer.";
  } else if (!fields.firstName || fields.firstName.length > 100 || !fields.lastName || fields.lastName.length > 100) {
    error = "First and last names are required and must be 100 characters or fewer.";
  } else if (fields.email && (fields.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email))) {
    error = "Enter a valid email address.";
  } else if (fields.phone.length > 40 || fields.specialization.length > 150) {
    error = "Phone must be 40 characters or fewer and specialization 150 characters or fewer.";
  }
  return { fields, error };
}

// Links a teacher profile to the school member with the same email and the teacher role, if one exists
// and is not already linked to another profile in this school.
async function findLinkableTeacherAccount(schoolId: string, email: string, excludeTeacherId?: string) {
  if (!email) return null;
  const [member] = await db
    .select({ userId: authUsers.id })
    .from(schoolMemberships)
    .innerJoin(authUsers, eq(schoolMemberships.userId, authUsers.id))
    .where(and(
      eq(schoolMemberships.schoolId, schoolId),
      eq(schoolMemberships.role, "teacher"),
      eq(authUsers.email, email),
    ))
    .limit(1);
  if (!member) return null;
  const [existing] = await db
    .select({ id: teachers.id })
    .from(teachers)
    .where(and(
      eq(teachers.schoolId, schoolId),
      eq(teachers.userId, member.userId),
      ...(excludeTeacherId ? [ne(teachers.id, excludeTeacherId)] : []),
    ))
    .limit(1);
  return existing ? null : member.userId;
}

export async function createTeacher(
  _previous: TeacherActionState,
  formData: FormData,
): Promise<TeacherActionState> {
  const { fields, error } = readTeacherFields(formData);
  if (error) return { error };
  const { session } = await requireSchoolRole(fields.schoolId, ["school_admin"]);
  const userId = await findLinkableTeacherAccount(fields.schoolId, fields.email);

  try {
    await db.transaction(async (tx) => {
      await tx.insert(teachers).values({
        id: randomUUID(),
        schoolId: fields.schoolId,
        userId,
        teacherNumber: fields.teacherNumber,
        firstName: fields.firstName,
        lastName: fields.lastName,
        email: fields.email || null,
        phone: fields.phone || null,
        specialization: fields.specialization || null,
      });
      await tx.insert(activityEvents).values({
        schoolId: fields.schoolId,
        userId: session.user.id,
        detail: `Added teacher profile: ${fields.firstName} ${fields.lastName}`,
      });
    });
  } catch (caught) {
    if (isDuplicateEntry(caught)) return { error: "That teacher number is already in use at this school." };
    throw caught;
  }
  revalidatePath("/teachers");
  revalidatePath("/timetable");
  return {
    success: `${fields.firstName} ${fields.lastName} was added${userId ? " and linked to their teacher account" : ""}.`,
  };
}

export async function updateTeacher(
  _previous: TeacherActionState,
  formData: FormData,
): Promise<TeacherActionState> {
  const teacherId = String(formData.get("teacherId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const { fields, error } = readTeacherFields(formData);
  if (error) return { error };
  if (!teacherId || !isTeacherStatus(status)) return { error: "Select a valid teacher status." };
  const { session } = await requireSchoolRole(fields.schoolId, ["school_admin"]);

  const [teacher] = await db
    .select({ id: teachers.id, userId: teachers.userId })
    .from(teachers)
    .where(and(eq(teachers.id, teacherId), eq(teachers.schoolId, fields.schoolId)))
    .limit(1);
  if (!teacher) return { error: "Teacher not found in this school." };
  const userId = teacher.userId ?? await findLinkableTeacherAccount(fields.schoolId, fields.email, teacherId);

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(teachers)
        .set({
          userId,
          teacherNumber: fields.teacherNumber,
          firstName: fields.firstName,
          lastName: fields.lastName,
          email: fields.email || null,
          phone: fields.phone || null,
          specialization: fields.specialization || null,
          status,
        })
        .where(and(eq(teachers.id, teacherId), eq(teachers.schoolId, fields.schoolId)));
      await tx.insert(activityEvents).values({
        schoolId: fields.schoolId,
        userId: session.user.id,
        detail: `Updated teacher profile: ${fields.firstName} ${fields.lastName}`,
      });
    });
  } catch (caught) {
    if (isDuplicateEntry(caught)) return { error: "That teacher number is already in use at this school." };
    throw caught;
  }
  revalidatePath("/teachers");
  revalidatePath(`/teachers/${teacherId}`);
  revalidatePath("/timetable");
  return { success: "Teacher profile saved." };
}

export async function changeTeacherStatus(formData: FormData): Promise<void> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const teacherId = String(formData.get("teacherId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (!schoolId || !teacherId || !isTeacherStatus(status)) throw new Error("Invalid teacher status update.");
  const { session } = await requireSchoolRole(schoolId, ["school_admin"]);
  const [teacher] = await db
    .select({ firstName: teachers.firstName, lastName: teachers.lastName })
    .from(teachers)
    .where(and(eq(teachers.id, teacherId), eq(teachers.schoolId, schoolId)))
    .limit(1);
  if (!teacher) throw new Error("Teacher not found in this school.");
  await db.transaction(async (tx) => {
    await tx.update(teachers)
      .set({ status })
      .where(and(eq(teachers.id, teacherId), eq(teachers.schoolId, schoolId)));
    await tx.insert(activityEvents).values({
      schoolId,
      userId: session.user.id,
      detail: `Updated ${teacher.firstName} ${teacher.lastName} status to ${status.replaceAll("_", " ")}`,
    });
  });
  revalidatePath("/teachers");
  revalidatePath("/timetable");
}
