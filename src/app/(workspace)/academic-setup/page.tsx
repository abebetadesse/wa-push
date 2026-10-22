import type { Metadata } from "next";
import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { academicYears, classrooms, gradeLevels, subjects } from "@/db/schema";
import { pageRoles, requireSchoolsFor } from "@/lib/workspace";
import { AcademicYearForm, ClassroomForm, GradeLevelForm, SubjectForm } from "./forms";

export const metadata: Metadata = { title: "Academic setup | Forma" };

async function AcademicSetupContent() {
  const { schoolIds: manageableIds, schools: managedSchools } = await requireSchoolsFor(pageRoles.schoolAdmin);
  const [years, grades, schoolSubjects, classRooms] = await Promise.all([
    db.select().from(academicYears).where(inArray(academicYears.schoolId, manageableIds)),
    db.select().from(gradeLevels).where(inArray(gradeLevels.schoolId, manageableIds)).orderBy(gradeLevels.sortOrder),
    db.select().from(subjects).where(inArray(subjects.schoolId, manageableIds)).orderBy(subjects.name),
    db.select({
      id: classrooms.id,
      schoolId: classrooms.schoolId,
      name: classrooms.name,
      academicYearId: classrooms.academicYearId,
      academicYearName: academicYears.name,
      gradeName: gradeLevels.name,
    })
      .from(classrooms)
      .innerJoin(academicYears, eq(classrooms.academicYearId, academicYears.id))
      .innerJoin(gradeLevels, eq(classrooms.gradeLevelId, gradeLevels.id))
      .where(inArray(classrooms.schoolId, manageableIds)),
  ]);

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/" className="management-back">← Dashboard</Link>
          <p className="auth-eyebrow">SCHOOL CONFIGURATION</p>
          <h1>Academic setup</h1>
          <p className="management-description">Configure academic years, grade levels, and subjects before planning lessons.</p>
        </div>
      </header>
      <div className="management-sections">
        {managedSchools.map((school) => (
          <section className="management-card" key={school.id}>
            <div className="management-card-heading"><div><h2>{school.name}</h2><p>{school.country || "Country not set"}</p></div></div>
            <div className="academic-columns">
              <div>
                <h3>Academic years</h3>
                <ul className="compact-list">
                  {years.filter((year) => year.schoolId === school.id).map((year) => <li key={year.id}><span>{year.name}</span>{year.isCurrent && <span className="role-badge">Current</span>}</li>)}
                </ul>
                <AcademicYearForm schools={[school]} />
              </div>
              <div>
                <h3>Grade levels</h3>
                <ul className="compact-list">
                  {grades.filter((grade) => grade.schoolId === school.id).map((grade) => <li key={grade.id}>{grade.name}</li>)}
                </ul>
                <GradeLevelForm schools={[school]} />
              </div>
              <div>
                <h3>Subjects</h3>
                <ul className="compact-list">
                  {schoolSubjects.filter((subject) => subject.schoolId === school.id).map((subject) => <li key={subject.id}>{subject.name}{subject.code ? ` · ${subject.code}` : ""}</li>)}
                </ul>
                <SubjectForm schools={[school]} />
              </div>
              <div>
                <h3>Classrooms</h3>
                <ul className="compact-list">
                  {classRooms.filter((classroom) => classroom.schoolId === school.id).map((classroom) => <li key={classroom.id}>{classroom.gradeName} {classroom.name} · {classroom.academicYearName}</li>)}
                </ul>
                <ClassroomForm
                  schoolId={school.id}
                  years={years.filter((year) => year.schoolId === school.id)}
                  grades={grades.filter((grade) => grade.schoolId === school.id)}
                />
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

export default function AcademicSetupPage() {
  return <Suspense fallback={<main className="auth-page"><p>Loading academic setup...</p></main>}><AcademicSetupContent /></Suspense>;
}
