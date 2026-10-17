"use client";

import { useActionState } from "react";
import { createSchool, type CreateSchoolState } from "./actions";

export function SchoolForm() {
  const [state, action, pending] = useActionState<CreateSchoolState, FormData>(
    createSchool,
    {},
  );

  return (
    <form action={action} className="auth-form">
      <label>
        School name
        <input autoComplete="organization" maxLength={180} minLength={2} name="name" required />
      </label>
      <label>
        Country <span className="optional-label">Optional</span>
        <input autoComplete="country-name" maxLength={100} name="country" />
      </label>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      <button className="primary-button auth-submit" disabled={pending} type="submit">
        {pending ? "Creating workspace..." : "Create school workspace"}
      </button>
    </form>
  );
}
