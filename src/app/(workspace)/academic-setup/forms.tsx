"use client";

import { useActionState } from "react";
import {
  createAcademicYear,
  createClassroom,
  createGradeLevel,
  createSubject,
  type AcademicSetupState,
} from "./actions";

export type AcademicSchoolOption = { id: string; name: string };
export type ClassroomYearOption = { id: string; name: string; isCurrent: boolean };
export type ClassroomGradeOption = { id: string; name: string };

function SchoolField({ schools }: { schools: AcademicSchoolOption[] }) {
  return schools.length > 1
    ? <label>School<select name="schoolId" required>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
    : <input name="schoolId" type="hidden" value={schools[0].id} />;
}

function Feedback({ state }: { state: AcademicSetupState }) {
  return <>
    {state.error && <p className="auth-error" role="alert">{state.error}</p>}
    {state.success && <p className="auth-success" role="status">{state.success}</p>}
  </>;
}

export function AcademicYearForm({ schools }: { schools: AcademicSchoolOption[] }) {
  const [state, action, pending] = useActionState<AcademicSetupState, FormData>(createAcademicYear, {});
  return <form action={action} className="auth-form setup-form">
    <SchoolField schools={schools} />
    <label>Year name<input maxLength={80} name="name" placeholder="e.g. 2026–2027" required /></label>
    <div className="form-two-columns">
      <label>Starts<input name="startsOn" required type="date" /></label>
      <label>Ends<input name="endsOn" required type="date" /></label>
    </div>
    <label className="checkbox-label"><input name="isCurrent" type="checkbox" /> Set as current year</label>
    <Feedback state={state} />
    <button className="primary-button auth-submit" disabled={pending} type="submit">{pending ? "Saving..." : "Add academic year"}</button>
  </form>;
}

export function GradeLevelForm({ schools }: { schools: AcademicSchoolOption[] }) {
  const [state, action, pending] = useActionState<AcademicSetupState, FormData>(createGradeLevel, {});
  return <form action={action} className="auth-form setup-form">
    <SchoolField schools={schools} />
    <label>Grade level<input maxLength={80} name="name" placeholder="e.g. Grade 7" required /></label>
    <Feedback state={state} />
    <button className="primary-button auth-submit" disabled={pending} type="submit">{pending ? "Saving..." : "Add grade level"}</button>
  </form>;
}

export function SubjectForm({ schools }: { schools: AcademicSchoolOption[] }) {
  const [state, action, pending] = useActionState<AcademicSetupState, FormData>(createSubject, {});
  return <form action={action} className="auth-form setup-form">
    <SchoolField schools={schools} />
    <label>Subject name<input maxLength={120} name="name" placeholder="e.g. Mathematics" required /></label>
    <label>Subject code <span className="optional-label">Optional</span><input maxLength={30} name="code" /></label>
    <Feedback state={state} />
    <button className="primary-button auth-submit" disabled={pending} type="submit">{pending ? "Saving..." : "Add subject"}</button>
  </form>;
}

export function ClassroomForm({
  schoolId,
  years,
  grades,
}: {
  schoolId: string;
  years: ClassroomYearOption[];
  grades: ClassroomGradeOption[];
}) {
  const [state, action, pending] = useActionState<AcademicSetupState, FormData>(createClassroom, {});
  return <form action={action} className="auth-form setup-form">
    <input name="schoolId" type="hidden" value={schoolId} />
    <label>Academic year<select name="academicYearId" required defaultValue={years.find((year) => year.isCurrent)?.id ?? ""}><option value="" disabled>Select a year</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isCurrent ? " · Current" : ""}</option>)}</select></label>
    <label>Grade level<select name="gradeLevelId" required defaultValue=""><option value="" disabled>Select a grade</option>{grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></label>
    <label>Class name<input maxLength={100} name="name" placeholder="e.g. 7A" required /></label>
    <label>Capacity <span className="optional-label">Optional</span><input max="500" min="1" name="capacity" type="number" /></label>
    <Feedback state={state} />
    <button className="primary-button auth-submit" disabled={pending || !years.length || !grades.length} type="submit">{pending ? "Saving..." : "Add classroom"}</button>
  </form>;
}
