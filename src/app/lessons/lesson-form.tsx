"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { createLesson, type LessonActionState } from "./actions";

export type LessonSchoolOption = { id: string; name: string };
export type LessonYearOption = { id: string; schoolId: string; name: string; isCurrent: boolean };
export type LessonLookupOption = { id: string; schoolId: string; name: string };

export function LessonForm({
  schools,
  years,
  grades,
  subjects,
}: {
  schools: LessonSchoolOption[];
  years: LessonYearOption[];
  grades: LessonLookupOption[];
  subjects: LessonLookupOption[];
}) {
  const [state, action, pending] = useActionState<LessonActionState, FormData>(createLesson, {});
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? "");
  const availableYears = useMemo(() => years.filter((item) => item.schoolId === schoolId), [years, schoolId]);
  const availableGrades = useMemo(() => grades.filter((item) => item.schoolId === schoolId), [grades, schoolId]);
  const availableSubjects = useMemo(() => subjects.filter((item) => item.schoolId === schoolId), [subjects, schoolId]);
  const ready = availableYears.length > 0 && availableGrades.length > 0 && availableSubjects.length > 0;

  return (
    <form action={action} className="auth-form">
      {schools.length > 1
        ? <label>School<select name="schoolId" onChange={(event) => setSchoolId(event.target.value)} required value={schoolId}>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
        : <input name="schoolId" type="hidden" value={schoolId} />}
      {!ready && <p className="setup-hint">Add an academic year, grade level, and subject in <a href="/academic-setup">Academic setup</a> before creating a lesson.</p>}
      <label>Academic year<select key={`year-${schoolId}`} disabled={!ready} name="academicYearId" required defaultValue={availableYears.find((year) => year.isCurrent)?.id ?? ""}><option value="" disabled>Select an academic year</option>{availableYears.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isCurrent ? " · Current" : ""}</option>)}</select></label>
      <div className="form-two-columns">
        <label>Grade level<select key={`grade-${schoolId}`} disabled={!ready} name="gradeLevelId" required defaultValue=""><option value="" disabled>Select a grade</option>{availableGrades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></label>
        <label>Subject<select key={`subject-${schoolId}`} disabled={!ready} name="subjectId" required defaultValue=""><option value="" disabled>Select a subject</option>{availableSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
      </div>
      <label>Lesson title<input maxLength={200} name="title" required /></label>
      <label>Unit or topic <span className="optional-label">Optional</span><input maxLength={160} name="unitTopic" /></label>
      <label>Objectives <span className="optional-label">Optional</span><textarea maxLength={5000} name="objectives" rows={4} /></label>
      <label>Scheduled date <span className="optional-label">Optional</span><input name="scheduledDate" type="date" /></label>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.success && <p className="auth-success" role="status">{state.success}</p>}
      <button className="primary-button auth-submit" disabled={pending || !ready} type="submit">{pending ? "Saving draft..." : "Save lesson draft"}</button>
    </form>
  );
}
