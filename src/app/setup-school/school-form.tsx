"use client";

import { useActionState } from "react";
import { createSchool, type CreateSchoolState } from "./actions";

export function SchoolForm({ clusters }: { clusters: { value: string; label: string }[] }) {
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
        School cluster <span className="optional-label">Optional</span>
        <select defaultValue="" name="clusterId">
          <option value="">Not in a cluster yet</option>
          {clusters.map((cluster) => <option key={cluster.value} value={cluster.value}>{cluster.label}</option>)}
        </select>
      </label>
      <label>
        Public address <span className="optional-label">Optional · /school/…</span>
        <input maxLength={80} name="slug" pattern="[a-z0-9-]+" placeholder="genet-preschool" />
      </label>
      <label>
        School code <span className="optional-label">Optional</span>
        <input maxLength={40} name="schoolCode" />
      </label>
      <label>
        Kebele <span className="optional-label">Optional</span>
        <input maxLength={120} name="kebele" />
      </label>
      <label>
        Country <span className="optional-label">Optional</span>
        <input autoComplete="country-name" defaultValue="Ethiopia" maxLength={100} name="country" />
      </label>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      <button className="primary-button auth-submit" disabled={pending} type="submit">
        {pending ? "Creating workspace..." : "Create school workspace"}
      </button>
    </form>
  );
}
