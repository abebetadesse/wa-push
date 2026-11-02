"use server";

import { guardAction, UserError, type ActionState } from "@/lib/action-result";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { activityEvents, authUsers, classrooms, enrollments, schoolMemberships, schools, studentApplications, students } from "@/db/schema";
import { PENDING_SCHOOL_APPLICATION } from "@/lib/accounts";
import { formFields } from "@/lib/form-fields";
import { attachMember } from "@/lib/invitations";
import { requirePrivilege } from "@/lib/permissions";
import { ensureSlugFree } from "@/lib/slug";

async function loadApplication(applicationId: string) {
  const [application] = await db.select().from(studentApplications).where(eq(studentApplications.id, applicationId)).limit(1);
  if (!application) throw new UserError("That application no longer exists.");
  if (application.status !== "pending") throw new UserError("That application was already handled.");
  return application;
}

async function approveImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const f = formFields(formData);
  const application = await loadApplication(f.id("applicationId", "an application"));
  const access = await requirePrivilege(application.schoolId, "applications", "approve");
  const classroomId = f.optionalId("classroomId", "a class");
  const studentNumber = (f.optional("studentNumber", "the student number", 80) ?? application.studentNumber ?? `ONL-${randomUUID().slice(0, 6).toUpperCase()}`);
  let classroom: { id: string; academicYearId: string } | undefined;
  if (classroomId) {
    [classroom] = await db.select({ id: classrooms.id, academicYearId: classrooms.academicYearId }).from(classrooms)
      .where(and(eq(classrooms.id, classroomId), eq(classrooms.schoolId, application.schoolId))).limit(1);
    if (!classroom) throw new UserError("Choose a class of this school.");
  }

  await db.transaction(async (tx) => {
    // Link to the school's existing record when the number matches one without an account.
    const [existing] = await tx.select({ id: students.id, userId: students.userId }).from(students)
      .where(and(eq(students.schoolId, application.schoolId), eq(students.studentNumber, studentNumber))).limit(1);
    if (existing?.userId) throw new UserError(`Student number ${studentNumber} already belongs to a student with an account.`);
    const studentId = existing?.id ?? randomUUID();
    if (existing) {
      await tx.update(students).set({ email: application.email, status: "active" }).where(eq(students.id, existing.id));
    } else {
      await tx.insert(students).values({
        id: studentId,
        schoolId: application.schoolId,
        studentNumber,
        firstName: application.firstName,
        lastName: application.lastName,
        email: application.email,
        gender: application.gender,
        dateOfBirth: application.dateOfBirth,
        status: "active",
      });
    }
    if (classroom) {
      await tx.insert(enrollments).values({ schoolId: application.schoolId, studentId, classroomId: classroom.id, academicYearId: classroom.academicYearId })
        .onDuplicateKeyUpdate({ set: { classroomId: classroom.id } });
    }
    await attachMember(tx, { schoolId: application.schoolId, userId: application.userId, email: application.email, role: "student" });
    await tx.update(authUsers).set({ banned: false, banReason: null, emailVerified: true })
      .where(and(eq(authUsers.id, application.userId), eq(authUsers.banReason, PENDING_SCHOOL_APPLICATION)));
    await tx.update(studentApplications).set({ status: "approved", reviewedBy: access.session.user.id, reviewedAt: new Date() }).where(eq(studentApplications.id, application.id));
    await tx.insert(activityEvents).values({ schoolId: application.schoolId, userId: access.session.user.id, detail: `Approved the student registration of ${application.firstName} ${application.lastName}`.slice(0, 255) });
  });
  revalidatePath("/applications");
  revalidatePath("/students");
  return { success: `${application.firstName} ${application.lastName} can now sign in as a student.` };
}

async function rejectImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const f = formFields(formData);
  const application = await loadApplication(f.id("applicationId", "an application"));
  const access = await requirePrivilege(application.schoolId, "applications", "approve");
  await db.update(studentApplications).set({ status: "rejected", reviewedBy: access.session.user.id, reviewedAt: new Date() }).where(eq(studentApplications.id, application.id));
  // The account was made only for this application: remove it unless it belongs to a school already.
  const [member] = await db.select({ id: schoolMemberships.id }).from(schoolMemberships).where(eq(schoolMemberships.userId, application.userId)).limit(1);
  if (!member) await db.delete(authUsers).where(and(eq(authUsers.id, application.userId), eq(authUsers.banReason, PENDING_SCHOOL_APPLICATION)));
  revalidatePath("/applications");
  return { success: "The application was declined." };
}

async function updatePublicSettingsImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const f = formFields(formData);
  const schoolId = f.id("schoolId", "a school");
  await requirePrivilege(schoolId, "school_profile", "edit");
  const slug = await ensureSlugFree(f.text("slug", "the public address", 80).toLowerCase(), schoolId);
  await db.update(schools).set({
    slug,
    studentRegistrationOpen: formData.get("studentRegistrationOpen") === "on",
    schoolCode: f.optional("schoolCode", "the school code", 40),
    kebele: f.optional("kebele", "the kebele", 120),
  }).where(eq(schools.id, schoolId));
  revalidatePath("/applications");
  revalidatePath(`/${slug}`);
  return { success: `Saved. The public page is /${slug}.` };
}

export async function approveApplication(...args: Parameters<typeof approveImpl>) { return guardAction(() => approveImpl(...args)); }
export async function rejectApplication(...args: Parameters<typeof rejectImpl>) { return guardAction(() => rejectImpl(...args)); }
export async function updatePublicSettings(...args: Parameters<typeof updatePublicSettingsImpl>) { return guardAction(() => updatePublicSettingsImpl(...args)); }
