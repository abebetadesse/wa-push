import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import Link from "next/link";
import Form from "next/form";
import { Suspense } from "react";
import { db } from "@/db";
import { certificates, certificateTemplates, schools } from "@/db/schema";

export const metadata: Metadata = { title: "Verify a certificate | Forma" };

type Params = Promise<{ code: string }>;

// Public: anyone holding a printed certificate can check it. Only what is printed on it is shown.
async function Verification({ params }: { params: Params }) {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
  const [row] = code.length === 8 ? await db.select({
    recipientName: certificates.recipientName,
    serial: certificates.serial,
    issuedAt: certificates.issuedAt,
    revokedAt: certificates.revokedAt,
    template: certificateTemplates.name,
    school: schools.name,
    slug: schools.slug,
  }).from(certificates)
    .innerJoin(certificateTemplates, eq(certificates.templateId, certificateTemplates.id))
    .innerJoin(schools, eq(certificates.schoolId, schools.id))
    .where(eq(certificates.verificationCode, code)).limit(1) : [];

  return (
    <main className="auth-page">
      <section className="auth-card verify-card">
        <p className="auth-eyebrow">CERTIFICATE VERIFICATION</p>
        {!row ? (
          <>
            <h1>Not found</h1>
            <p className="auth-description">No certificate has the code {code ? <strong>{code.slice(0, 4)}-{code.slice(4)}</strong> : "you entered"}. Check the code printed at the bottom of the certificate.</p>
          </>
        ) : (
          <>
            <h1 className={row.revokedAt ? "verify-revoked" : "verify-valid"}>{row.revokedAt ? "Revoked certificate" : "Valid certificate"}</h1>
            <dl className="verify-details">
              <dt>Awarded to</dt><dd>{row.recipientName}</dd>
              <dt>Certificate</dt><dd>{row.template}</dd>
              <dt>Issued by</dt><dd><Link href={`/${row.slug}`}>{row.school}</Link></dd>
              <dt>Serial number</dt><dd>{row.serial}</dd>
              <dt>Issued on</dt><dd>{row.issuedAt.toISOString().slice(0, 10)}</dd>
              {row.revokedAt && <><dt>Revoked on</dt><dd>{row.revokedAt.toISOString().slice(0, 10)}</dd></>}
            </dl>
          </>
        )}
        <Form action="/verify" className="auth-form">
          <label>Check another code<input maxLength={12} name="code" placeholder="K7Q2-M9XA" /></label>
          <button className="secondary-button" type="submit">Verify</button>
        </Form>
      </section>
    </main>
  );
}

export default function VerifyPage({ params }: { params: Params }) {
  return <Suspense fallback={<main className="auth-page"><p>Checking…</p></main>}><Verification params={params} /></Suspense>;
}
