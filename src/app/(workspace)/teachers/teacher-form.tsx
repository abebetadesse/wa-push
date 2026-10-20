"use client";

import { useActionState } from "react";
import { createTeacher, updateTeacher, type TeacherActionState } from "./actions";

export type EditableTeacher = {
  id: string;
  schoolId: string;
  teacherNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  specialization: string | null;
  status: "active" | "on_leave" | "inactive";
};

export function TeacherForm({
  schools,
  teacher,
}: {
  schools: { id: string; name: string }[];
  teacher?: EditableTeacher;
}) {
  const [state, action, pending] = useActionState<TeacherActionState, FormData>(teacher ? updateTeacher : createTeacher, {});
  return (
    <form action={action} className="auth-form">
      {teacher && <input name="teacherId" type="hidden" value={teacher.id} />}
      {!teacher && schools.length > 1
        ? <label>School<select name="schoolId" required>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
        : <input name="schoolId" type="hidden" value={teacher?.schoolId ?? schools[0]?.id ?? ""} />}
      <div className="form-two-columns">
        <label>First name<input autoComplete="off" defaultValue={teacher?.firstName} maxLength={100} name="firstName" required /></label>
        <label>Last name<input autoComplete="off" defaultValue={teacher?.lastName} maxLength={100} name="lastName" required /></label>
        <label>Teacher number<input defaultValue={teacher?.teacherNumber} maxLength={80} name="teacherNumber" required /></label>
        <label>Specialization <span className="optional-label">Optional</span><input defaultValue={teacher?.specialization ?? ""} maxLength={150} name="specialization" placeholder="e.g. Mathematics" /></label>
        <label>Email <span className="optional-label">Optional</span><input autoComplete="off" defaultValue={teacher?.email ?? ""} maxLength={254} name="email" type="email" /></label>
        <label>Phone <span className="optional-label">Optional</span><input autoComplete="off" defaultValue={teacher?.phone ?? ""} maxLength={40} name="phone" type="tel" /></label>
        {teacher && <label>Status
          <select defaultValue={teacher.status} name="status">
            <option value="active">Active</option>
            <option value="on_leave">On leave</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>}
      </div>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.success && <p className="auth-success" role="status">{state.success}</p>}
      <button className="primary-button auth-submit" disabled={pending} type="submit">
        {pending ? "Saving..." : teacher ? "Save teacher" : "Add teacher"}
      </button>
    </form>
  );
}
