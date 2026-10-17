"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { activityEvents, authUsers, schoolInvitations, schoolMemberships, staffMembers, students } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { hashInvitationToken } from "@/lib/invitations";
import { isPlatformAdmin, requireSchoolRole } from "@/lib/permissions";

export type InviteState = {
  error?: string;
  success?: string;
};

const inviteRoles = ["school_admin", "teacher", "student", "inventory_manager", "hr_manager"] as const;
type InviteRole = (typeof inviteRoles)[number];

function isInviteRole(value: string): value is InviteRole {
  return inviteRoles.some((candidate) => candidate === value);
}

export async function inviteMember(_previous: InviteState, formData: FormData): Promise<InviteState> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "").trim();

  if (!schoolId || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address and school." };
  }
  if (!isInviteRole(role)) {
    return { error: "Select a valid school role." };
  }

  const access = await requireSchoolRole(schoolId, ["school_admin"]);
  if (role === "school_admin" && !isPlatformAdmin(access.session)) {
    return { error: "Only a platform administrator can invite another school administrator." };
  }
  if (role === "student") {
    const matchingStudents = await db
      .select({ id: students.id, userId: students.userId })
      .from(students)
      .where(and(
        eq(students.schoolId, schoolId),
        eq(students.email, email),
        eq(students.status, "active"),
      ))
      .limit(2);
    if (matchingStudents.length !== 1) {
      return { error: "A student invitation requires exactly one active student record with this email address." };
    }
    if (matchingStudents[0].userId) {
      return { error: "This student record is already linked to an account." };
    }
  }

  const token = randomBytes(32).toString("base64url");
  const invitationId = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.transaction(async (tx) => {
    await tx
      .delete(schoolInvitations)
      .where(and(
        eq(schoolInvitations.schoolId, schoolId),
        eq(schoolInvitations.email, email),
        isNull(schoolInvitations.acceptedAt),
      ));
    await tx.insert(schoolInvitations).values({
      id: invitationId,
      schoolId,
      invitedBy: access.session.user.id,
      email,
      role,
      tokenHash: hashInvitationToken(token),
      expiresAt,
    });
  });

  const baseUrl = process.env.BETTER_AUTH_URL;
  if (!baseUrl) throw new Error("BETTER_AUTH_URL is required to create invitation links.");

  try {
    await sendEmail({
      to: email,
      subject: `Invitation to join ${access.school.name} on Forma`,
      text: `You have been invited to join ${access.school.name} as ${role.replaceAll("_", " ")}. Create your secure account within seven days: ${new URL(`/accept-invite?token=${encodeURIComponent(token)}`, baseUrl).toString()}\n\nIf you were not expecting this invitation, you can ignore this message.`,
    });
  } catch (error) {
    console.error("Failed to deliver a school invitation.", error);
    await db.delete(schoolInvitations).where(eq(schoolInvitations.id, invitationId));
    return { error: "The invitation email could not be delivered. Check the mail server configuration and try again." };
  }

  await db.insert(activityEvents).values({
    schoolId,
    userId: access.session.user.id,
    detail: `Invited ${email} as ${role.replaceAll("_", " ")}`,
  });
  revalidatePath("/team");
  revalidatePath("/");
  return { success: `Invitation sent to ${email}.` };
}

const staffRoles = ["school_admin", "teacher", "inventory_manager", "hr_manager"] as const;
type StaffRole = (typeof staffRoles)[number];

function isStaffRole(value: string): value is StaffRole {
  return staffRoles.some((candidate) => candidate === value);
}

export async function revokeInvitation(formData: FormData): Promise<void> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const invitationId = String(formData.get("invitationId") ?? "").trim();
  if (!schoolId || !invitationId) throw new Error("Invalid invitation request.");
  const { session } = await requireSchoolRole(schoolId, ["school_admin"]);

  const [invitation] = await db
    .select({ email: schoolInvitations.email })
    .from(schoolInvitations)
    .where(and(
      eq(schoolInvitations.id, invitationId),
      eq(schoolInvitations.schoolId, schoolId),
      isNull(schoolInvitations.acceptedAt),
    ))
    .limit(1);
  if (!invitation) throw new Error("Pending invitation not found in this school.");

  await db.transaction(async (tx) => {
    await tx.delete(schoolInvitations).where(and(
      eq(schoolInvitations.id, invitationId),
      eq(schoolInvitations.schoolId, schoolId),
      isNull(schoolInvitations.acceptedAt),
    ));
    await tx.insert(activityEvents).values({
      schoolId,
      userId: session.user.id,
      detail: `Revoked the invitation for ${invitation.email}`,
    });
  });
  revalidatePath("/team");
}

async function loadManagedMember(schoolId: string, userId: string) {
  const access = await requireSchoolRole(schoolId, ["school_admin"]);
  if (userId === access.session.user.id) throw new Error("You cannot change your own school access.");
  const [member] = await db
    .select({ id: schoolMemberships.id, role: schoolMemberships.role, name: authUsers.name })
    .from(schoolMemberships)
    .innerJoin(authUsers, eq(schoolMemberships.userId, authUsers.id))
    .where(and(eq(schoolMemberships.schoolId, schoolId), eq(schoolMemberships.userId, userId)))
    .limit(1);
  if (!member) throw new Error("Member not found in this school.");
  if (member.role === "school_admin" && !isPlatformAdmin(access.session)) {
    throw new Error("Only a platform administrator can change a school administrator's access.");
  }
  return { ...access, member };
}

export async function changeMemberRole(formData: FormData): Promise<void> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const userId = String(formData.get("userId") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  if (!schoolId || !userId || !isStaffRole(role)) throw new Error("Invalid role change request.");

  const { session, member } = await loadManagedMember(schoolId, userId);
  if (!isStaffRole(member.role)) throw new Error("Student and guardian accounts cannot be given staff roles.");
  if (role === "school_admin" && !isPlatformAdmin(session)) {
    throw new Error("Only a platform administrator can assign the school administrator role.");
  }
  if (member.role === role) return;

  await db.transaction(async (tx) => {
    await tx
      .update(schoolMemberships)
      .set({ role })
      .where(and(eq(schoolMemberships.id, member.id), eq(schoolMemberships.schoolId, schoolId)));
    await tx.insert(activityEvents).values({
      schoolId,
      userId: session.user.id,
      detail: `Changed ${member.name}'s role to ${role.replaceAll("_", " ")}`,
    });
  });
  revalidatePath("/team");
}

export async function removeMember(formData: FormData): Promise<void> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const userId = String(formData.get("userId") ?? "").trim();
  if (!schoolId || !userId) throw new Error("Invalid member removal request.");

  const { session, member } = await loadManagedMember(schoolId, userId);
  await db.transaction(async (tx) => {
    await tx
      .delete(schoolMemberships)
      .where(and(eq(schoolMemberships.id, member.id), eq(schoolMemberships.schoolId, schoolId)));
    // Unlink school records so the person can be invited again later; the records themselves are kept.
    await tx
      .update(students)
      .set({ userId: null })
      .where(and(eq(students.schoolId, schoolId), eq(students.userId, userId)));
    await tx
      .update(staffMembers)
      .set({ userId: null })
      .where(and(eq(staffMembers.schoolId, schoolId), eq(staffMembers.userId, userId)));
    await tx.insert(activityEvents).values({
      schoolId,
      userId: session.user.id,
      detail: `Removed ${member.name} from the school team`,
    });
  });
  revalidatePath("/team");
  revalidatePath("/");
}
