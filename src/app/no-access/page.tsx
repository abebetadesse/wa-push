import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignOutButton } from "@/app/sign-out-button";
import { getHomePath, getWorkspaceContext } from "@/lib/workspace";

export const metadata: Metadata = { title: "Access restricted | Forma" };

async function NoAccessContent() {
  const context = await getWorkspaceContext();
  const home = context ? getHomePath(context.access) : null;

  // Signed in with a workspace: they opened a page their role cannot use.
  if (context && home) {
    return (
      <>
        <h1>This page isn’t available to you</h1>
        <p className="auth-description">Your role doesn’t include access to that page. If you need it, ask a school administrator to change your role.</p>
        <div className="no-access-actions">
          <Link className="primary-button" href={home}>{home === "/" ? "Go to dashboard" : "Go to my learning"}</Link>
          <SignOutButton />
        </div>
      </>
    );
  }

  // Signed in, but not a member of any active school.
  if (context) {
    return (
      <>
        <h1>No school access yet</h1>
        <p className="auth-description">
          You’re signed in as <strong>{context.userEmail}</strong>, but this account isn’t assigned to an active school.
          Ask a school administrator to invite this email address, then open the link in the invitation.
        </p>
        <div className="no-access-actions"><SignOutButton /></div>
      </>
    );
  }

  return (
    <>
      <h1>Sign in required</h1>
      <p className="auth-description">Sign in with the account your school invited to continue.</p>
      <div className="no-access-actions"><Link className="primary-button" href="/login">Go to sign in</Link></div>
    </>
  );
}

export default function NoAccessPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="brand auth-brand" href="/" aria-label="Forma home">
          <span className="brand-mark">f</span><span>forma<span className="brand-dot">.</span></span>
        </Link>
        <p className="auth-eyebrow">Access restricted</p>
        <Suspense fallback={<p className="auth-description">Checking your access…</p>}>
          <NoAccessContent />
        </Suspense>
      </section>
    </main>
  );
}
