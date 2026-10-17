import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Account invitation required | Forma",
};

export default function RegisterPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="brand auth-brand" href="/" aria-label="Forma home">
          <span className="brand-mark">f</span><span>forma<span className="brand-dot">.</span></span>
        </Link>
        <p className="auth-eyebrow">SECURE ACCESS</p>
        <h1>Invitation required</h1>
        <p className="auth-description">
          Forma accounts are created from a school invitation. Ask a school administrator to invite your email address.
        </p>
        <p className="auth-switch"><Link href="/login">Return to sign in</Link></p>
      </section>
    </main>
  );
}
