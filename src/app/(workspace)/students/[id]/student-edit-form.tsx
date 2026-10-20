"use client";

import { useActionState } from "react";
import { updateStudent, type StudentActionState } from "../actions";

export type EditableStudent = {
  id: string;
  schoolId: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  dateOfBirth: string | null;
  status: "active" | "inactive" | "graduated" | "transferred";
  classroomId: string | null;
};

export function StudentEditForm({
  student,
  classrooms,
  hasCurrentYear,
}: {
  student: EditableStudent;
  classrooms: { id: string; name: string; gradeName: string }[];
  hasCurrentYear: boolean;
}) {
  const [state, action, pending] = useActionState<StudentActionState, FormData>(updateStudent, {});

  return (
    <form action={action} className="auth-form student-form">
      <input name="schoolId" type="hidden" value={student.schoolId} />
      <input name="studentId" type="hidden" value={student.id} />
      <div className="form-two-columns">
        <label>First name<input autoComplete="off" defaultValue={student.firstName} maxLength={100} name="firstName" required /></label>
        <label>Last name<input autoComplete="off" defaultValue={student.lastName} maxLength={100} name="lastName" required /></label>
        <label>Student number<input defaultValue={student.studentNumber} maxLength={80} name="studentNumber" required /></label>
        <label>Status
          <select defaultValue={student.status} name="status">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="graduated">Graduated</option>
            <option value="transferred">Transferred</option>
          </select>
        </label>
        <label>Email <span className="optional-label">Optional</span><input autoComplete="off" defaultValue={student.email ?? ""} maxLength={254} name="email" type="email" /></label>
        <label>Date of birth <span className="optional-label">Optional</span><input defaultValue={student.dateOfBirth ?? ""} name="dateOfBirth" type="date" /></label>
      </div>
      <label>Current classroom
        <select defaultValue={student.classroomId ?? ""} disabled={!hasCurrentYear} name="classroomId">
          <option value="">{hasCurrentYear ? "Not enrolled this year" : "No current academic year configured"}</option>
          {classrooms.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.gradeName} {classroom.name}</option>)}
        </select>
      </label>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.success && <p className="auth-success" role="status">{state.success}</p>}
      <button className="primary-button auth-submit" disabled={pending} type="submit">{pending ? "Saving..." : "Save student"}</button>
    </form>
  );
}
