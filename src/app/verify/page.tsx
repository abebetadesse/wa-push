import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Form from "next/form";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Verify a certificate | Forma" };

type SearchParams = Promise<{ code?: string }>;

async function VerifyForm({ searchParams }: { searchParams: SearchParams }) {
  const { code } = await searchParams;
  const cleaned = (code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned) redirect(`/verify/${cleaned}`);
  return (
    <main className="auth-page">
      <section className="auth-card verify-card">
        <p className="auth-eyebrow">CERTIFICATE VERIFICATION</p>
        <h1>Check a certificate</h1>
        <p className="auth-description">Type the verification code printed at the bottom of the certificate.</p>
        <Form action="/verify" className="auth-form">
          <label>Verification code<input autoFocus maxLength={12} name="code" placeholder="K7Q2-M9XA" required /></label>
          <button className="primary-button auth-submit" type="submit">Verify</button>
        </Form>
      </section>
    </main>
  );
}

export default function VerifyIndexPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<main className="auth-page"><p>Loading…</p></main>}><VerifyForm searchParams={searchParams} /></Suspense>;
}
