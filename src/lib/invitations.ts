import "server-only";
import { createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { authUsers, schoolInvitations, schoolMemberships, staffMembers, students } from "@/db/schema";
import { isStaffRole } from "@/lib/roles";

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

    if (invitation.role === "student") {
      const studentRows = await tx
        .select({ id: students.id, userId: students.userId })
        .from(students)
        .where(and(
          eq(students.schoolId, invitation.schoolId),
          eq(students.email, invitation.email),
          eq(students.status, "active"),
        ))
        .limit(2)
        .for("update");
      if (studentRows.length !== 1 || (studentRows[0].userId && studentRows[0].userId !== userId)) {
        throw new Error("This student invitation no longer matches an unlinked active student record.");
      }
      await tx
        .update(students)
        .set({ userId })
        .where(and(eq(students.id, studentRows[0].id), eq(students.schoolId, invitation.schoolId)));
    } else if (isStaffRole(invitation.role) && invitation.role !== "school_admin") {
      const matchingStaff = await tx
        .select({ id: staffMembers.id, userId: staffMembers.userId })
        .from(staffMembers)
        .where(and(
          eq(staffMembers.schoolId, invitation.schoolId),
          eq(staffMembers.email, invitation.email),
          eq(staffMembers.status, "active"),
        ))
        .limit(2)
        .for("update");
      if (matchingStaff.length > 1 || (matchingStaff[0]?.userId && matchingStaff[0].userId !== userId)) {
        throw new Error("This staff invitation no longer matches a unique unlinked active staff record.");
      }
      if (matchingStaff[0]) {
        await tx.update(staffMembers)
          .set({ userId })
          .where(and(eq(staffMembers.id, matchingStaff[0].id), eq(staffMembers.schoolId, invitation.schoolId)));
      }
    }

    await tx.insert(schoolMemberships).values({
      schoolId: invitation.schoolId,
      userId,
      role: invitation.role,
    });
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
