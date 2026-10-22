"use server";

import { guardAction, UserError, type ActionState } from "@/lib/action-result";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { activityEvents, staffAttendance, staffContracts, staffLeave, staffMembers } from "@/db/schema";
import { formFields } from "@/lib/form-fields";
import { requireSchoolRole } from "@/lib/permissions";
import { isDuplicateEntry } from "@/lib/db-errors";
import { humanize } from "@/lib/format";
import { CONTRACT_TYPES, LEAVE_TYPES, STAFF_ATTENDANCE_STATUSES } from "./options";

export type HrActionState = { error?: string; success?: string };

const HR_ROLES = ["school_admin", "hr_manager"] as const;

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
  const { session } = await requireSchoolRole(schoolId, HR_ROLES);
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
  const { session } = await requireSchoolRole(schoolId, HR_ROLES);
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

async function schoolStaff(schoolId: string, staffId: string) {
  const [staff] = await db.select({ id: staffMembers.id, userId: staffMembers.userId, firstName: staffMembers.firstName, lastName: staffMembers.lastName })
    .from(staffMembers)
    .where(and(eq(staffMembers.id, staffId), eq(staffMembers.schoolId, schoolId)))
    .limit(1);
  if (!staff) throw new UserError("Staff member not found in this school.");
  return staff;
}

async function requestLeaveImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const f = formFields(formData);
  const schoolId = f.id("schoolId", "a school");
  const { session } = await requireSchoolRole(schoolId, HR_ROLES);
  const staff = await schoolStaff(schoolId, f.id("staffId", "a staff member"));
  const leaveType = f.choice("leaveType", "a leave type", LEAVE_TYPES);
  const startsOn = f.date("startsOn", "start date");
  const endsOn = f.date("endsOn", "end date");
  if (endsOn < startsOn) throw new UserError("The leave can't end before it starts.");
  const reason = f.optional("reason", "the reason", 500);
  await db.transaction(async (tx) => {
    await tx.insert(staffLeave).values({ schoolId, staffId: staff.id, leaveType, startsOn, endsOn, reason, createdBy: session.user.id });
    await tx.insert(activityEvents).values({ schoolId, userId: session.user.id, detail: `Recorded ${leaveType} leave request for ${staff.firstName} ${staff.lastName}` });
  });
  revalidatePath("/hr");
  return { success: `Leave request recorded for ${staff.firstName} ${staff.lastName}.` };
}

async function decideLeaveImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const f = formFields(formData);
  const schoolId = f.id("schoolId", "a school");
  const { session, role } = await requireSchoolRole(schoolId, HR_ROLES);
  const decision = f.choice("decision", "a decision", ["approved", "rejected", "cancelled"] as const);
  const [leave] = await db.select({ id: staffLeave.id, status: staffLeave.status, staffId: staffLeave.staffId })
    .from(staffLeave)
    .where(and(eq(staffLeave.id, f.id("leaveId", "a leave request")), eq(staffLeave.schoolId, schoolId)))
    .limit(1);
  if (!leave) throw new UserError("Leave request not found.");
  const allowed = decision === "cancelled" ? leave.status === "requested" || leave.status === "approved" : leave.status === "requested";
  if (!allowed) throw new UserError(`A ${leave.status} request can't be ${decision}.`);
  const staff = await schoolStaff(schoolId, leave.staffId);
  if (decision !== "cancelled" && staff.userId === session.user.id && role === "hr_manager") {
    throw new UserError("Your own leave must be decided by a school administrator.");
  }
  await db.transaction(async (tx) => {
    await tx.update(staffLeave).set({ status: decision, decidedBy: session.user.id, decidedAt: new Date() }).where(eq(staffLeave.id, leave.id));
    await tx.insert(activityEvents).values({ schoolId, userId: session.user.id, detail: `Marked leave for ${staff.firstName} ${staff.lastName} as ${decision}` });
  });
  revalidatePath("/hr");
  return {};
}

async function addContractImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const f = formFields(formData);
  const schoolId = f.id("schoolId", "a school");
  const { session } = await requireSchoolRole(schoolId, HR_ROLES);
  const staff = await schoolStaff(schoolId, f.id("staffId", "a staff member"));
  const contractType = f.choice("contractType", "a contract type", CONTRACT_TYPES);
  const position = f.text("position", "the position", 120);
  const startsOn = f.date("startsOn", "start date");
  const endsOn = f.optionalDate("endsOn", "end date");
  if (endsOn && endsOn < startsOn) throw new UserError("The contract can't end before it starts.");
  const notes = f.optional("notes", "the notes", 500);
  await db.transaction(async (tx) => {
    await tx.insert(staffContracts).values({ schoolId, staffId: staff.id, contractType, position, startsOn, endsOn, notes });
    await tx.insert(activityEvents).values({ schoolId, userId: session.user.id, detail: `Recorded a ${humanize(contractType).toLowerCase()} contract for ${staff.firstName} ${staff.lastName}` });
  });
  revalidatePath("/hr");
  return { success: `Contract recorded for ${staff.firstName} ${staff.lastName}.` };
}

async function endContractImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const f = formFields(formData);
  const schoolId = f.id("schoolId", "a school");
  await requireSchoolRole(schoolId, HR_ROLES);
  await db.update(staffContracts).set({ status: "ended" })
    .where(and(eq(staffContracts.id, f.id("contractId", "a contract")), eq(staffContracts.schoolId, schoolId)));
  revalidatePath("/hr");
  return {};
}

async function recordStaffAttendanceImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const f = formFields(formData);
  const schoolId = f.id("schoolId", "a school");
  const { session } = await requireSchoolRole(schoolId, HR_ROLES);
  const day = f.date("date", "date");
  const staffRows = await db.select({ id: staffMembers.id }).from(staffMembers)
    .where(and(eq(staffMembers.schoolId, schoolId), eq(staffMembers.status, "active")));
  const entries = staffRows.flatMap(({ id: staffId }) => {
    const status = String(formData.get(`status:${staffId}`) ?? "");
    if (!(STAFF_ATTENDANCE_STATUSES as readonly string[]).includes(status)) return [];
    const remarks = String(formData.get(`remarks:${staffId}`) ?? "").trim().slice(0, 255) || null;
    return [{ staffId, status: status as (typeof STAFF_ATTENDANCE_STATUSES)[number], remarks }];
  });
  if (entries.length === 0) throw new UserError("There are no active staff to record.");
  await db.transaction(async (tx) => {
    for (const entry of entries) {
      await tx.insert(staffAttendance)
        .values({ schoolId, date: day, recordedBy: session.user.id, ...entry })
        .onDuplicateKeyUpdate({ set: { status: entry.status, remarks: entry.remarks, recordedBy: session.user.id } });
    }
    await tx.insert(activityEvents).values({ schoolId, userId: session.user.id, detail: `Recorded staff attendance for ${day}` });
  });
  revalidatePath("/hr");
  return { success: `Saved attendance for ${entries.length} staff on ${day}.` };
}

// Every action runs through guardAction, so a failure reaches the form as a message instead of
// a blank HTTP 500 (Next.js hides thrown messages in production).
export async function createStaffMember(...args: Parameters<typeof createStaffMemberImpl>) {
  return guardAction(() => createStaffMemberImpl(...args));
}
export async function changeStaffStatus(...args: Parameters<typeof changeStaffStatusImpl>) {
  return guardAction(() => changeStaffStatusImpl(...args));
}
export async function requestLeave(...args: Parameters<typeof requestLeaveImpl>) {
  return guardAction(() => requestLeaveImpl(...args));
}
export async function decideLeave(...args: Parameters<typeof decideLeaveImpl>) {
  return guardAction(() => decideLeaveImpl(...args));
}
export async function addContract(...args: Parameters<typeof addContractImpl>) {
  return guardAction(() => addContractImpl(...args));
}
export async function endContract(...args: Parameters<typeof endContractImpl>) {
  return guardAction(() => endContractImpl(...args));
}
export async function recordStaffAttendance(...args: Parameters<typeof recordStaffAttendanceImpl>) {
  return guardAction(() => recordStaffAttendanceImpl(...args));
}
