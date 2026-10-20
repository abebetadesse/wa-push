import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/permissions";
import { SchoolForm } from "./school-form";

export const metadata: Metadata = {
  title: "Set up a school | Forma",
};

async function SchoolSetup() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (!isPlatformAdmin(session)) redirect("/no-access");

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="brand auth-brand" href="/" aria-label="Forma home">
          <span className="brand-mark">f</span><span>forma<span className="brand-dot">.</span></span>
        </Link>
        <p className="auth-eyebrow">SCHOOL WORKSPACE</p>
        <h1>Create a school</h1>
        <p className="auth-description">
          Add a school workspace and assign its first administrator.
        </p>
        <SchoolForm />
        <p className="auth-switch"><Link href="/">← Back to dashboard</Link></p>
        <p className="auth-note">Only platform administrators can provision schools. School data is restricted to authorized members.</p>
      </section>
    </main>
  );
}

export default function SetupSchoolPage() {
  return (
    <Suspense fallback={<main className="auth-page"><p>Loading school setup...</p></main>}>
      <SchoolSetup />
    </Suspense>
  );
}
