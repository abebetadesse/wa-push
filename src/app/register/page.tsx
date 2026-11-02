import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { selfRegistrationOpen } from "@/lib/portal-policy";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Create an account | Forma",
};

// The rules can change at any time, so they are read on each request, never at build time.
async function RegisterContent() {
  await connection();
  const open = selfRegistrationOpen();
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="brand auth-brand" href="/" aria-label="Forma home">
          <span className="brand-mark">f</span><span>forma<span className="brand-dot">.</span></span>
        </Link>
        <p className="auth-eyebrow">SECURE ACCESS</p>
        <h1>{open ? "Create an account" : "Registration is closed"}</h1>
        <p className="auth-description">
          {open
            ? "Register with your email address. An administrator approves new accounts before they can sign in, then adds you to your school."
            : "Forma accounts are added by a school administrator. Ask them to add your email address."}
        </p>
        {open && <RegisterForm />}
        <p className="auth-switch"><Link href="/login">Return to sign in</Link></p>
      </section>
    </main>
  );
}

export default function RegisterPage() {
  return <Suspense fallback={<main className="auth-page"><p>Loading...</p></main>}><RegisterContent /></Suspense>;
}
