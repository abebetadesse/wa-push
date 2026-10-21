"use server";

import { guardAction, UserError, type ActionState } from "@/lib/action-result";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { activityEvents, staffMembers } from "@/db/schema";
import { requireSchoolRole } from "@/lib/permissions";
import { isDuplicateEntry } from "@/lib/db-errors";

export type HrActionState = { error?: string; success?: string };

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

async function createStaffMemberImpl(
  _previous: HrActionState,
  formData: FormData,
): Promise<HrActionState> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const employeeNumber = String(formData.get("employeeNumber") ?? "").trim();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const jobTitle = String(formData.get("jobTitle") ?? "").trim();
  const hiredOn = String(formData.get("hiredOn") ?? "").trim();
  if (!schoolId || !employeeNumber || employeeNumber.length > 80) {
    return { error: "Enter an employee number of 80 characters or fewer." };
  }
  if (!firstName || firstName.length > 100 || !lastName || lastName.length > 100 || !jobTitle || jobTitle.length > 120) {
    return { error: "First name, last name, and job title are required and must fit their field limits." };
  }
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return { error: "Enter a valid email address." };
  }
  if (phone.length > 40 || (hiredOn && !isDate(hiredOn))) {
    return { error: "Enter a valid phone number and hire date." };
  }
  const { session } = await requireSchoolRole(schoolId, ["school_admin", "hr_manager"]);
  try {
    await db.transaction(async (tx) => {
      await tx.insert(staffMembers).values({
        id: randomUUID(),
        schoolId,
        employeeNumber,
        firstName,
        lastName,
        email: email || null,
        phone: phone || null,
        jobTitle,
        hiredOn: hiredOn || null,
      });
      await tx.insert(activityEvents).values({
        schoolId,
        userId: session.user.id,
        detail: `Added staff member: ${firstName} ${lastName}`,
      });
    });
  } catch (error) {
    if (isDuplicateEntry(error)) return { error: "That employee number is already in use at this school." };
    throw error;
  }
  revalidatePath("/hr");
  return { success: `${firstName} ${lastName} was added to the staff directory.` };
}

async function changeStaffStatusImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const staffId = String(formData.get("staffId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (!schoolId || !staffId || (status !== "active" && status !== "on_leave" && status !== "inactive")) {
    throw new UserError("Invalid staff status update.");
  }
  const { session } = await requireSchoolRole(schoolId, ["school_admin", "hr_manager"]);
  const [staff] = await db.select({ firstName: staffMembers.firstName, lastName: staffMembers.lastName })
    .from(staffMembers)
    .where(and(eq(staffMembers.id, staffId), eq(staffMembers.schoolId, schoolId)))
    .limit(1);
  if (!staff) throw new UserError("Staff member not found in this school.");
  await db.transaction(async (tx) => {
    await tx.update(staffMembers)
      .set({ status })
      .where(and(eq(staffMembers.id, staffId), eq(staffMembers.schoolId, schoolId)));
    await tx.insert(activityEvents).values({
      schoolId,
      userId: session.user.id,
      detail: `Updated ${staff.firstName} ${staff.lastName} status to ${status.replaceAll("_", " ")}`,
    });
  });
  revalidatePath("/hr");
  return {};
}

// Every action runs through guardAction, so a failure reaches the form as a message instead of
// a blank HTTP 500 (Next.js hides thrown messages in production).
export async function createStaffMember(...args: Parameters<typeof createStaffMemberImpl>) {
  return guardAction(() => createStaffMemberImpl(...args));
}
export async function changeStaffStatus(...args: Parameters<typeof changeStaffStatusImpl>) {
  return guardAction(() => changeStaffStatusImpl(...args));
}
