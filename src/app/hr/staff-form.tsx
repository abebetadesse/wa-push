"use client";

import { useActionState } from "react";
import { createStaffMember, type HrActionState } from "./actions";

type SchoolOption = { id: string; name: string };

export function StaffForm({ schools }: { schools: SchoolOption[] }) {
  const [state, action, pending] = useActionState<HrActionState, FormData>(createStaffMember, {});
  return (
    <form action={action} className="auth-form">
      {schools.length > 1
        ? <label>School<select name="schoolId" required>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
        : <input name="schoolId" type="hidden" value={schools[0]?.id ?? ""} />}
      <div className="form-two-columns">
        <label>Employee number<input maxLength={80} name="employeeNumber" required /></label>
        <label>Job title<input maxLength={120} name="jobTitle" required /></label>
        <label>First name<input autoComplete="given-name" maxLength={100} name="firstName" required /></label>
        <label>Last name<input autoComplete="family-name" maxLength={100} name="lastName" required /></label>
        <label>Email <span className="optional-label">Optional</span><input autoComplete="email" maxLength={254} name="email" type="email" /></label>
        <label>Phone <span className="optional-label">Optional</span><input autoComplete="tel" maxLength={40} name="phone" type="tel" /></label>
        <label>Hire date <span className="optional-label">Optional</span><input name="hiredOn" type="date" /></label>
      </div>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.success && <p className="auth-success" role="status">{state.success}</p>}
      <button className="primary-button auth-submit" disabled={pending} type="submit">{pending ? "Adding staff..." : "Add staff member"}</button>
    </form>
  );
}
