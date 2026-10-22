import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db";
import { schools, teachers } from "@/db/schema";
import { hasSchoolRole, pageRoles, requireWorkspaceContext } from "@/lib/workspace";
import { TeacherForm } from "../teacher-form";

export const metadata: Metadata = { title: "Edit teacher | Forma" };

async function TeacherDetail({ teacherId }: { teacherId: string }) {
  const context = await requireWorkspaceContext();

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

  if (!hasSchoolRole(context, teacher.schoolId, pageRoles.schoolAdmin)) notFound();

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

async function TeacherDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TeacherDetail teacherId={id} />;
}

export default function TeacherPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main className="auth-page"><p>Loading teacher profile...</p></main>}>
      <TeacherDetailRoute params={params} />
    </Suspense>
  );
}
