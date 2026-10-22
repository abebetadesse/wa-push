import type { Metadata } from "next";
import { and, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import {
  academicYears,
  classrooms,
  gradeLevels,
  learningResources,
  subjects,
  teachers,
} from "@/db/schema";
import { pageRoles, requireSchoolsFor } from "@/lib/workspace";
import { GeneratorClient } from "./generator-client";

export const metadata: Metadata = {
  title: "Auto-generate lesson plans | Forma",
};

async function GenerateLessonsContent() {
  const { context, schoolIds, schools: visibleSchools, hasRole } = await requireSchoolsFor(pageRoles.academics);

  const [years, grades, schoolSubjects, schoolClassrooms, schoolTeachers, resources] = await Promise.all([
    db
      .select({ id: academicYears.id, schoolId: academicYears.schoolId, name: academicYears.name, isCurrent: academicYears.isCurrent })
      .from(academicYears)
      .where(inArray(academicYears.schoolId, schoolIds))
      .orderBy(academicYears.startsOn),
    db
      .select({ id: gradeLevels.id, schoolId: gradeLevels.schoolId, name: gradeLevels.name })
      .from(gradeLevels)
      .where(inArray(gradeLevels.schoolId, schoolIds))
      .orderBy(gradeLevels.sortOrder),
    db
      .select({ id: subjects.id, schoolId: subjects.schoolId, name: subjects.name })
      .from(subjects)
      .where(inArray(subjects.schoolId, schoolIds))
      .orderBy(subjects.name),
    db
      .select({ id: classrooms.id, schoolId: classrooms.schoolId, name: classrooms.name, academicYearId: classrooms.academicYearId, gradeLevelId: classrooms.gradeLevelId })
      .from(classrooms)
      .where(inArray(classrooms.schoolId, schoolIds))
      .orderBy(classrooms.name),
    db
      .select({ id: teachers.id, schoolId: teachers.schoolId, firstName: teachers.firstName, lastName: teachers.lastName })
      .from(teachers)
      .where(and(inArray(teachers.schoolId, schoolIds), eq(teachers.status, "active")))
      .orderBy(teachers.lastName, teachers.firstName),
    db
      .select({
        id: learningResources.id,
        schoolId: learningResources.schoolId,
        title: learningResources.title,
        fileName: learningResources.fileName,
        sizeBytes: learningResources.sizeBytes,
      })
      .from(learningResources)
      .where(inArray(learningResources.schoolId, schoolIds))
      .orderBy(learningResources.createdAt),
  ]);

  const teacherOptions = schoolTeachers.map((t) => ({
    id: t.id,
    schoolId: t.schoolId,
    name: `${t.firstName} ${t.lastName}`,
  }));

  const canApprove = context.platformAdmin || schoolIds.some((sId) => hasRole(sId, "school_admin"));

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/lessons" className="management-back">← Back to lesson plans</Link>
          <p className="auth-eyebrow">AUTOMATED CURRICULUM PLANNING</p>
          <h1>Auto-generate Lesson Plans from Textbooks &amp; Resources</h1>
          <p className="management-description">
            Generate complete lesson sequences for every unit and topic from uploaded textbooks or outlines, map them directly to class timetable slots, and edit or approve them immediately.
          </p>
        </div>
      </header>

      <GeneratorClient
        schools={visibleSchools}
        years={years}
        grades={grades}
        subjects={schoolSubjects}
        classrooms={schoolClassrooms}
        teachers={teacherOptions}
        resources={resources}
        canApprove={canApprove}
        userRole={context.roles[0]?.role}
      />
    </main>
  );
}

export default function GenerateLessonsPage() {
  return (
    <Suspense fallback={<main className="auth-page"><p>Loading curriculum generator...</p></main>}>
      <GenerateLessonsContent />
    </Suspense>
  );
}
