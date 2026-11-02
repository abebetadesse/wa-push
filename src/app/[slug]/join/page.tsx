import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RecordForm } from "@/components/record-form";
import { loadPublicSchool } from "@/lib/public-school";
import { applyForStudentAccount } from "./actions";

export const metadata: Metadata = { title: "Student registration | Forma" };

type Params = Promise<{ slug: string }>;

async function JoinForm({ params }: { params: Params }) {
  const { slug } = await params;
  const school = await loadPublicSchool(slug);
  if (!school) notFound();
  return (
    <main className="auth-page">
      <section className="auth-card join-card">
        <Link className="management-back" href={`/${school.slug}`}>← {school.name}</Link>
        <p className="auth-eyebrow">STUDENT REGISTRATION</p>
        <h1>Join {school.name}</h1>
        {!school.studentRegistrationOpen ? (
          <p className="auth-description">This school is not taking registrations online right now. Contact the school office to be added.</p>
        ) : (
          <>
            <p className="auth-description">Create your student account. The school checks every registration; once approved you can sign in to follow your attendance, results and certificates and talk with your classmates.</p>
            <RecordForm action={applyForStudentAccount} hidden={{ slug: school.slug }} pendingLabel="Sending…" submitLabel="Send registration" fields={[
              { name: "firstName", label: "First name", required: true, max: 100 },
              { name: "lastName", label: "Father's name / last name", required: true, max: 100 },
              { name: "email", label: "Email", type: "email", required: true, max: 254 },
              { name: "password", label: "Password (12+ characters)", type: "password", required: true, max: 128, placeholder: "At least 12 characters" },
              { name: "gender", label: "Sex", type: "select", options: [{ value: "female", label: "Female" }, { value: "male", label: "Male" }] },
              { name: "dateOfBirth", label: "Date of birth", type: "date" },
              { name: "gradeName", label: "Grade or level", max: 80, placeholder: "KG 2, Grade 5…" },
              { name: "studentNumber", label: "Student number (if you have one)", max: 80 },
              { name: "guardianPhone", label: "Parent / guardian phone", type: "tel", max: 40 },
              { name: "message", label: "Message to the school", type: "textarea", max: 1000 },
              { name: "consent", label: "A parent or guardian agrees to this registration", type: "checkbox" },
            ]} />
          </>
        )}
        <p className="auth-switch">Already approved? <Link href="/login">Sign in</Link></p>
      </section>
    </main>
  );
}

export default function JoinPage({ params }: { params: Params }) {
  return <Suspense fallback={<main className="auth-page"><p>Loading…</p></main>}><JoinForm params={params} /></Suspense>;
}
