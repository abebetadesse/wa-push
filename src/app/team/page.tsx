import type { Metadata } from "next";
import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db";
import { authUsers, schoolInvitations, schoolMemberships, schools } from "@/db/schema";
import { getAccessibleSchools, getSession, isPlatformAdmin } from "@/lib/permissions";
import { InviteForm } from "./invite-form";
import { MemberActions, RevokeInvitationButton } from "./member-actions";

export const metadata: Metadata = { title: "School team | Forma" };

async function TeamContent() {
  const session = await getSession();
  if (!session) redirect("/login");
  const platformAdmin = isPlatformAdmin(session);
  const accessibleSchools = await getAccessibleSchools();

  const memberships = platformAdmin
    ? []
    : await db
      .select({ schoolId: schoolMemberships.schoolId, role: schoolMemberships.role })
      .from(schoolMemberships)
      .where(eq(schoolMemberships.userId, session.user.id));
  const manageableIds = platformAdmin
    ? accessibleSchools.map((school) => school.id)
    : memberships.filter(({ role }) => role === "school_admin").map(({ schoolId }) => schoolId);

  if (manageableIds.length === 0) redirect("/no-access");
  const managedSchools = accessibleSchools.filter((school) => manageableIds.includes(school.id));

  const [members, invitations] = await Promise.all([
    db
      .select({
        schoolId: schoolMemberships.schoolId,
        userId: authUsers.id,
        name: authUsers.name,
        email: authUsers.email,
        role: schoolMemberships.role,
      })
      .from(schoolMemberships)
      .innerJoin(authUsers, eq(schoolMemberships.userId, authUsers.id))
      .where(inArray(schoolMemberships.schoolId, manageableIds)),
    db
      .select({
        id: schoolInvitations.id,
        schoolId: schoolInvitations.schoolId,
        email: schoolInvitations.email,
        role: schoolInvitations.role,
        expiresAt: schoolInvitations.expiresAt,
        schoolName: schools.name,
      })
      .from(schoolInvitations)
      .innerJoin(schools, eq(schoolInvitations.schoolId, schools.id))
      .where(and(
        inArray(schoolInvitations.schoolId, manageableIds),
        isNull(schoolInvitations.acceptedAt),
        gt(schoolInvitations.expiresAt, new Date()),
      )),
  ]);

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/" className="management-back">← Dashboard</Link>
          <p className="auth-eyebrow">ACCESS MANAGEMENT</p>
          <h1>School team</h1>
          <p className="management-description">Invite staff, change school roles, remove access, and revoke pending invitations. Re-inviting an email replaces its pending invitation.</p>
        </div>
      </header>
      <div className="management-sections">
        {managedSchools.map((school) => {
          const schoolMembers = members.filter((member) => member.schoolId === school.id);
          const schoolInvitations = invitations.filter((invitation) => invitation.schoolId === school.id);
          return (
            <section className="management-card" key={school.id}>
              <div className="management-card-heading">
                <div><h2>{school.name}</h2><p>{school.country || "Country not set"}</p></div>
              </div>
              <h3>Invite a team member</h3>
              <InviteForm schoolId={school.id} allowSchoolAdmin={platformAdmin} />
              <h3>Current members</h3>
              <div className="record-list">
                {schoolMembers.map((member) => (
                  <div className="record-row student-record" key={member.userId}>
                    <div><strong>{member.name}{member.userId === session.user.id ? " (you)" : ""}</strong><small>{member.email}</small></div>
                    <span className="role-badge">{member.role.replaceAll("_", " ")}</span>
                    {member.userId !== session.user.id && (platformAdmin || member.role !== "school_admin") && (
                      <MemberActions
                        schoolId={school.id}
                        userId={member.userId}
                        name={member.name}
                        role={member.role}
                        allowSchoolAdmin={platformAdmin}
                      />
                    )}
                  </div>
                ))}
              </div>
              {schoolInvitations.length > 0 && <>
                <h3>Pending invitations</h3>
                <div className="record-list">
                  {schoolInvitations.map((invitation) => (
                    <div className="record-row" key={invitation.id}>
                      <div><strong>{invitation.email}</strong><small>Expires {invitation.expiresAt.toLocaleDateString()}</small></div>
                      <span className="role-badge">{invitation.role.replaceAll("_", " ")}</span>
                      <RevokeInvitationButton schoolId={school.id} invitationId={invitation.id} email={invitation.email} />
                    </div>
                  ))}
                </div>
              </>}
            </section>
          );
        })}
      </div>
    </main>
  );
}

export default function TeamPage() {
  return <Suspense fallback={<main className="auth-page"><p>Loading team access...</p></main>}><TeamContent /></Suspense>;
}
