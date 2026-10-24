"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { registerStudent, type StudentActionState } from "./actions";

export type StudentSchoolOption = { id: string; name: string };
export type StudentClassOption = {
  id: string;
  schoolId: string;
  gradeName: string;
  name: string;
  academicYearName: string;
};

export function StudentForm({
  schools,
  classrooms,
}: {
  schools: StudentSchoolOption[];
  classrooms: StudentClassOption[];
}) {
  const [state, action, pending] = useActionState<StudentActionState, FormData>(registerStudent, {});
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? "");
  const availableClasses = useMemo(
    () => classrooms.filter((classroom) => classroom.schoolId === schoolId),
    [classrooms, schoolId],
  );

  return (
    <form action={action} className="auth-form student-form">
      {schools.length > 1 && <label>School<select name="schoolId" onChange={(event) => setSchoolId(event.target.value)} required value={schoolId}>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>}
      {schools.length === 1 && <input name="schoolId" type="hidden" value={schools[0].id} />}
      <div className="form-two-columns">
        <label>First name<input autoComplete="given-name" maxLength={100} name="firstName" required /></label>
        <label>Last name<input autoComplete="family-name" maxLength={100} name="lastName" required /></label>
      </div>
      <label>Student number<input maxLength={80} name="studentNumber" required /></label>
      <label>Current classroom <span className="optional-label">Optional</span>
        <select key={schoolId} disabled={!availableClasses.length} name="classroomId" defaultValue="">
          <option value="">{availableClasses.length ? "Not enrolled in a classroom" : "No current classrooms configured"}</option>
          {availableClasses.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.gradeName} {classroom.name} · {classroom.academicYearName}</option>)}
        </select>
      </label>
      <label>Email <span className="optional-label">Optional</span><input autoComplete="email" maxLength={254} name="email" type="email" /></label>
      <label>Guardian email <span className="optional-label">Optional · for attendance updates</span><input autoComplete="email" maxLength={254} name="guardianEmail" type="email" /></label>
      <label>Date of birth <span className="optional-label">Optional</span><input name="dateOfBirth" type="date" /></label>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.success && <p className="auth-success" role="status">{state.success}</p>}
      <button className="primary-button auth-submit" disabled={pending} type="submit">{pending ? "Registering..." : "Register student"}</button>
    </form>
  );
}
