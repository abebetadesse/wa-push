import Link from "next/link";
import { SignOutButton } from "@/app/sign-out-button";

export default function NoAccessPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="auth-eyebrow">ACCESS RESTRICTED</p>
        <h1>No school access</h1>
        <p className="auth-description">Your account is not assigned to an active school workspace. Ask a school administrator for an invitation.</p>
        <div className="no-access-actions">
          <Link className="primary-button" href="/login">Return to sign in</Link>
          <SignOutButton />
        </div>
      </section>
    </main>
  );
}
