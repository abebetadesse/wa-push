import type { Metadata } from "next";
import { and, eq, gt, isNull, ne } from "drizzle-orm";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { db } from "@/db";
import { schoolInvitations, schools } from "@/db/schema";
import { hashInvitationToken } from "@/lib/invitations";
import { InviteAcceptForm } from "./invite-accept-form";

export const metadata: Metadata = { title: "Accept invitation | Forma" };

async function AcceptInviteContent({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token || token.length > 128) return <InvalidInvitation />;
  await connection();

  const [invitation] = await db
    .select({
      email: schoolInvitations.email,
      role: schoolInvitations.role,
      schoolName: schools.name,
    })
    .from(schoolInvitations)
    .innerJoin(schools, eq(schoolInvitations.schoolId, schools.id))
    .where(and(
      eq(schoolInvitations.tokenHash, hashInvitationToken(token)),
      isNull(schoolInvitations.acceptedAt),
      gt(schoolInvitations.expiresAt, new Date()),
      ne(schools.status, "suspended"),
    ))
    .limit(1);

  if (!invitation) return <InvalidInvitation />;

  return (
    <InviteAcceptForm
      email={invitation.email}
      role={invitation.role}
      schoolName={invitation.schoolName}
      token={token}
    />
  );
}

function InvalidInvitation() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="auth-eyebrow">SCHOOL INVITATION</p>
        <h1>Invitation unavailable</h1>
        <p className="auth-description">This invitation may have expired, been revoked, or already been used. Ask a school administrator to send a new one.</p>
        <p className="auth-switch"><Link href="/login">Go to sign in</Link></p>
      </section>
    </main>
  );
}

export default function AcceptInvitePage(props: { searchParams: Promise<{ token?: string }> }) {
  return <Suspense fallback={<main className="auth-page"><p>Checking invitation...</p></main>}><AcceptInviteContent {...props} /></Suspense>;
}
