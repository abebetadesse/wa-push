import type { Metadata } from "next";
import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { RecordForm, RowButton } from "@/components/record-form";
import { db } from "@/db";
import { academicYears, classrooms, gradeLevels, subjects } from "@/db/schema";
import { pageRoles, requireSchoolsFor } from "@/lib/workspace";
import { deleteClassroom, deleteGradeLevel, setUpGradesAndSections } from "./actions";
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
      isCurrentYear: academicYears.isCurrent,
      gradeLevelId: classrooms.gradeLevelId,
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
          <p className="management-description">Configure academic years, grades with their sections, and subjects before planning lessons. Set up Grades 1–12 with sections A–F in one step, and add or delete grades and sections whenever you need.</p>
        </div>
      </header>
      <div className="management-sections">
        {managedSchools.map((school) => {
          const schoolGrades = grades.filter((grade) => grade.schoolId === school.id);
          const schoolRooms = classRooms.filter((classroom) => classroom.schoolId === school.id)
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
          return (
          <section className="management-card" key={school.id}>
            <div className="management-card-heading"><div><h2>{school.name}</h2><p>{school.country || "Country not set"}</p></div></div>
            <div className="grade-setup">
              <h3>Grades & sections</h3>
              <RecordForm action={setUpGradesAndSections} hidden={{ schoolId: school.id }} pendingLabel="Setting up…" submitLabel="Set up grades and sections" fields={[
                { name: "fromGrade", label: "From grade", type: "number", min: 1, max: 12, required: true, defaultValue: "1" },
                { name: "toGrade", label: "To grade", type: "number", min: 1, max: 12, required: true, defaultValue: "12" },
                { name: "sections", label: "Sections per grade", type: "select", required: true, defaultValue: "6", options: Array.from({ length: 26 }, (_, index) => ({ value: String(index + 1), label: `${index + 1} (A–${"ABCDEFGHIJKLMNOPQRSTUVWXYZ"[index]})` })) },
                { name: "capacity", label: "Students per section", type: "number", min: 1, max: 500 },
                { name: "addSubjects", label: "Also add the national curriculum subjects for these grades", type: "checkbox", defaultValue: "on" },
              ]} />
              {schoolGrades.length === 0 ? <p className="empty-state">No grades yet.</p> : (
                <ul className="grade-sections">
                  {schoolGrades.map((grade) => {
                    const sections = schoolRooms.filter((room) => room.gradeLevelId === grade.id);
                    return (
                      <li key={grade.id}>
                        <strong>{grade.name}</strong>
                        <span className="section-chips">
                          {sections.length === 0 && <small>no sections</small>}
                          {sections.map((room) => (
                            <span className="section-chip" key={room.id} title={room.academicYearName}>
                              {room.name}{room.isCurrentYear ? "" : ` · ${room.academicYearName}`}
                              <RowButton action={deleteClassroom} confirm={`Delete section ${room.name}? Its timetable is removed too.`} hidden={{ schoolId: school.id, classroomId: room.id }} label="×" pendingLabel="…" />
                            </span>
                          ))}
                        </span>
                        <RowButton action={deleteGradeLevel} confirm={`Delete ${grade.name} and all its sections?`} danger hidden={{ schoolId: school.id, gradeLevelId: grade.id }} label="Delete grade" />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="academic-columns">
              <div>
                <h3>Academic years</h3>
                <ul className="compact-list">
                  {years.filter((year) => year.schoolId === school.id).map((year) => <li key={year.id}><span>{year.name}</span>{year.isCurrent && <span className="role-badge">Current</span>}</li>)}
                </ul>
                <AcademicYearForm schools={[school]} />
              </div>
              <div>
                <h3>Add a grade</h3>
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
                <h3>Add a section</h3>
                <ClassroomForm
                  schoolId={school.id}
                  years={years.filter((year) => year.schoolId === school.id)}
                  grades={grades.filter((grade) => grade.schoolId === school.id)}
                />
              </div>
            </div>
          </section>
          );
        })}
      </div>
    </main>
  );
}

export default function AcademicSetupPage() {
  return <Suspense fallback={<main className="auth-page"><p>Loading academic setup...</p></main>}><AcademicSetupContent /></Suspense>;
}
