import "server-only";
import { createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { authUsers, schoolInvitations, schoolMemberships, staffMembers, students } from "@/db/schema";
import { isStaffRole, type SchoolRoleName } from "@/lib/roles";

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function findPendingInvitation(token: string, email: string) {
  const tokenHash = hashInvitationToken(token);
  const [invitation] = await db
    .select({
      id: schoolInvitations.id,
      schoolId: schoolInvitations.schoolId,
      email: schoolInvitations.email,
      role: schoolInvitations.role,
      expiresAt: schoolInvitations.expiresAt,
    })
    .from(schoolInvitations)
    .where(and(
      eq(schoolInvitations.tokenHash, tokenHash),
      eq(schoolInvitations.email, email.trim().toLowerCase()),
      isNull(schoolInvitations.acceptedAt),
      gt(schoolInvitations.expiresAt, new Date()),
    ))
    .limit(1);

  return invitation ?? null;
}

export async function acceptInvitation(token: string, email: string, userId: string) {
  const tokenHash = hashInvitationToken(token);

  await db.transaction(async (tx) => {
    const [invitation] = await tx
      .select()
      .from(schoolInvitations)
      .where(and(
        eq(schoolInvitations.tokenHash, tokenHash),
        eq(schoolInvitations.email, email.trim().toLowerCase()),
        isNull(schoolInvitations.acceptedAt),
        gt(schoolInvitations.expiresAt, new Date()),
      ))
      .limit(1)
      .for("update");

    if (!invitation) {
      throw new Error("This invitation has expired or has already been accepted.");
    }

    await attachMember(tx, { schoolId: invitation.schoolId, userId, email: invitation.email, role: invitation.role });
    await tx
      .update(schoolInvitations)
      .set({ acceptedAt: new Date() })
      .where(eq(schoolInvitations.id, invitation.id));
    await tx
      .update(authUsers)
      .set({ emailVerified: true })
      .where(eq(authUsers.id, userId));
  });
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Gives an account its place in a school: links the matching student or staff record, then adds the
 * membership. Shared by accepted invitations and by administrators who add a person directly.
 */
export async function attachMember(tx: Transaction, input: { schoolId: string; userId: string; email: string; role: SchoolRoleName }) {
  const userId = input.userId;
  if (input.role === "student") {
    const studentRows = await tx
      .select({ id: students.id, userId: students.userId })
      .from(students)
      .where(and(
        eq(students.schoolId, input.schoolId),
        eq(students.email, input.email),
        eq(students.status, "active"),
      ))
      .limit(2)
      .for("update");
    if (studentRows.length !== 1 || (studentRows[0].userId && studentRows[0].userId !== userId)) {
      throw new Error("There must be exactly one unlinked active student record with this email address.");
    }
    await tx
      .update(students)
      .set({ userId })
      .where(and(eq(students.id, studentRows[0].id), eq(students.schoolId, input.schoolId)));
  } else if (isStaffRole(input.role) && input.role !== "school_admin") {
    const matchingStaff = await tx
      .select({ id: staffMembers.id, userId: staffMembers.userId })
      .from(staffMembers)
      .where(and(
        eq(staffMembers.schoolId, input.schoolId),
        eq(staffMembers.email, input.email),
        eq(staffMembers.status, "active"),
      ))
      .limit(2)
      .for("update");
    if (matchingStaff.length > 1 || (matchingStaff[0]?.userId && matchingStaff[0].userId !== userId)) {
      throw new Error("This email matches more than one staff record, or a staff record already linked to another account.");
    }
    if (matchingStaff[0]) {
      await tx.update(staffMembers)
        .set({ userId })
        .where(and(eq(staffMembers.id, matchingStaff[0].id), eq(staffMembers.schoolId, input.schoolId)));
    }
  }

  await tx.insert(schoolMemberships).values({
    schoolId: input.schoolId,
    userId,
    role: input.role,
  });
}
