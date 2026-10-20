import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db";
import { schoolMemberships, schools, teachers } from "@/db/schema";
import { getSession, isPlatformAdmin } from "@/lib/permissions";
import { TeacherForm } from "../teacher-form";

export const metadata: Metadata = { title: "Edit teacher | Forma" };

async function TeacherDetail({ teacherId }: { teacherId: string }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [teacher] = await db
    .select({
      id: teachers.id,
      schoolId: teachers.schoolId,
      schoolName: schools.name,
      schoolStatus: schools.status,
      teacherNumber: teachers.teacherNumber,
      firstName: teachers.firstName,
      lastName: teachers.lastName,
      email: teachers.email,
      phone: teachers.phone,
      specialization: teachers.specialization,
      status: teachers.status,
      userId: teachers.userId,
    })
    .from(teachers)
    .innerJoin(schools, eq(teachers.schoolId, schools.id))
    .where(eq(teachers.id, teacherId))
    .limit(1);
  if (!teacher || teacher.schoolStatus === "suspended") notFound();

  if (!isPlatformAdmin(session)) {
    const [membership] = await db
      .select({ role: schoolMemberships.role })
      .from(schoolMemberships)
      .where(and(eq(schoolMemberships.schoolId, teacher.schoolId), eq(schoolMemberships.userId, session.user.id)))
      .limit(1);
    if (membership?.role !== "school_admin") notFound();
  }

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/teachers" className="management-back">← Teachers</Link>
          <p className="auth-eyebrow">{teacher.schoolName.toUpperCase()}</p>
          <h1>{teacher.firstName} {teacher.lastName}</h1>
          <p className="management-description">
            {teacher.teacherNumber}{teacher.userId ? " · Linked to a teacher account" : " · Not linked to a sign-in account"}
            {" · "}<Link className="text-link" href={`/timetable?teacherId=${teacher.id}`}>View timetable</Link>
          </p>
        </div>
        <span className={`role-badge status-${teacher.status}`}>{teacher.status.replaceAll("_", " ")}</span>
      </header>
      <div className="management-sections">
        <section className="management-card">
          <h2>Edit teacher profile</h2>
          <TeacherForm schools={[{ id: teacher.schoolId, name: teacher.schoolName }]} teacher={teacher} />
        </section>
      </div>
    </main>
  );
}

export default function TeacherPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main className="auth-page"><p>Loading teacher profile...</p></main>}>
      {params.then(({ id }) => <TeacherDetail teacherId={id} />)}
    </Suspense>
  );
}
