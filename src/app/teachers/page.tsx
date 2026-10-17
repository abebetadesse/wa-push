import type { Metadata } from "next";
import { and, count, eq, inArray, ne } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db";
import { classSchedules, schoolMemberships, schools, teachers } from "@/db/schema";
import { getAccessibleSchools, getSession, isPlatformAdmin } from "@/lib/permissions";
import { changeTeacherStatus } from "./actions";
import { TeacherForm } from "./teacher-form";

export const metadata: Metadata = { title: "Teachers | Forma" };

async function TeachersContent() {
  const session = await getSession();
  if (!session) redirect("/login");
  const platformAdmin = isPlatformAdmin(session);
  const accessibleSchools = await getAccessibleSchools();
  const memberships = platformAdmin
    ? []
    : await db.select({ schoolId: schoolMemberships.schoolId, role: schoolMemberships.role })
      .from(schoolMemberships)
      .where(eq(schoolMemberships.userId, session.user.id));
  const schoolIds = platformAdmin
    ? accessibleSchools.map((school) => school.id)
    : memberships.filter(({ role }) => role === "school_admin" || role === "teacher").map(({ schoolId }) => schoolId);
  if (schoolIds.length === 0) redirect("/no-access");
  const manageableIds = platformAdmin
    ? schoolIds
    : memberships.filter(({ role }) => role === "school_admin").map(({ schoolId }) => schoolId);
  const manageableSchools = accessibleSchools.filter((school) => manageableIds.includes(school.id));

  const [teacherRows, periodCounts] = await Promise.all([
    db.select({
      id: teachers.id,
      schoolId: teachers.schoolId,
      schoolName: schools.name,
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
      .where(inArray(teachers.schoolId, schoolIds))
      .orderBy(schools.name, teachers.lastName, teachers.firstName),
    db.select({ teacherId: classSchedules.teacherId, total: count() })
      .from(classSchedules)
      .where(and(inArray(classSchedules.schoolId, schoolIds), ne(classSchedules.status, "cancelled")))
      .groupBy(classSchedules.teacherId),
  ]);
  const periodsByTeacher = new Map(periodCounts.map((row) => [row.teacherId, Number(row.total)]));

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/" className="management-back">← Dashboard</Link>
          <p className="auth-eyebrow">TEACHING &amp; LEARNING</p>
          <h1>Teachers</h1>
          <p className="management-description">Teacher profiles used for timetables. A profile is linked to a sign-in account when its email matches a school member with the teacher role.</p>
        </div>
      </header>
      <div className="management-sections">
        {manageableSchools.length > 0 && <section className="management-card">
          <h2>Add a teacher</h2>
          <TeacherForm schools={manageableSchools} />
        </section>}
        <section className="management-card">
          <div className="management-card-heading"><div><h2>Teacher directory</h2><p>{teacherRows.length} teacher{teacherRows.length === 1 ? "" : "s"}</p></div></div>
          {teacherRows.length === 0
            ? <p className="empty-state">No teacher profiles have been added yet.</p>
            : <div className="record-list">{teacherRows.map((teacher) => {
              const canManage = manageableIds.includes(teacher.schoolId);
              const periods = periodsByTeacher.get(teacher.id) ?? 0;
              return (
                <div className="record-row student-record" key={teacher.id}>
                  <div>
                    <strong>{teacher.firstName} {teacher.lastName}{teacher.specialization ? ` · ${teacher.specialization}` : ""}</strong>
                    <small>
                      {teacher.teacherNumber} · {teacher.schoolName}{teacher.email ? ` · ${teacher.email}` : ""}{teacher.phone ? ` · ${teacher.phone}` : ""}
                      {" · "}<Link className="text-link" href={`/timetable?teacherId=${teacher.id}`}>{periods} weekly period{periods === 1 ? "" : "s"}</Link>
                      {teacher.userId ? " · Account linked" : ""}
                    </small>
                  </div>
                  <span className={`role-badge status-${teacher.status}`}>{teacher.status.replaceAll("_", " ")}</span>
                  {canManage && <form action={changeTeacherStatus}>
                    <input name="schoolId" type="hidden" value={teacher.schoolId} />
                    <input name="teacherId" type="hidden" value={teacher.id} />
                    <input name="status" type="hidden" value={teacher.status === "active" ? "on_leave" : "active"} />
                    <button className="secondary-button record-action" type="submit">{teacher.status === "active" ? "Set on leave" : "Set active"}</button>
                  </form>}
                  {canManage && <Link className="secondary-button record-action" href={`/teachers/${teacher.id}`} style={{ display: "inline-flex", alignItems: "center" }}>Edit</Link>}
                </div>
              );
            })}</div>}
        </section>
      </div>
    </main>
  );
}

export default function TeachersPage() {
  return <Suspense fallback={<main className="auth-page"><p>Loading teachers...</p></main>}><TeachersContent /></Suspense>;
}
