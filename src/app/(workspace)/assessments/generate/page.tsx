import type { Metadata } from "next";
import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import {
  academicYears,
  classrooms,
  gradeLevels,
  learningResources,
  subjects,
} from "@/db/schema";
import { pageRoles, requireSchoolsFor } from "@/lib/workspace";
import { AssessmentGeneratorClient } from "./generator-client";

export const metadata: Metadata = {
  title: "Auto-generate Quizzes & Exercises | Forma",
};

async function GenerateAssessmentContent() {
  const { context, schoolIds, schools: visibleSchools, hasRole } = await requireSchoolsFor(pageRoles.academics);

  const [years, grades, schoolSubjects, schoolClassrooms, resources] = await Promise.all([
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
      .select({
        id: learningResources.id,
        schoolId: learningResources.schoolId,
        title: learningResources.title,
        fileName: learningResources.fileName,
        gradeLevelId: learningResources.gradeLevelId,
        subjectId: learningResources.subjectId,
      })
      .from(learningResources)
      .where(inArray(learningResources.schoolId, schoolIds))
      .orderBy(learningResources.createdAt),
  ]);

  const canPublish = context.platformAdmin || schoolIds.some((sId) => hasRole(sId, "school_admin"));

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/assessments" className="management-back">← Back to assessments</Link>
          <p className="auth-eyebrow">AUTOMATED ASSESSMENT ENGINE</p>
          <h1>Auto-generate Quizzes &amp; Exercises from Textbooks</h1>
          <p className="management-description">
            Generate multiple-choice quizzes, diagnostic exercises, and unit tests directly from Ethiopian curriculum textbooks. Review and customize questions and answers before publishing to students.
          </p>
        </div>
      </header>

      <AssessmentGeneratorClient
        schools={visibleSchools}
        years={years}
        grades={grades}
        subjects={schoolSubjects}
        classrooms={schoolClassrooms}
        resources={resources}
        canPublish={canPublish}
      />
    </main>
  );
}

export default function GenerateAssessmentPage() {
  return (
    <Suspense fallback={<main className="auth-page"><p>Loading assessment generator...</p></main>}>
      <GenerateAssessmentContent />
    </Suspense>
  );
}
