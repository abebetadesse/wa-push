"use client";

import { useActionState } from "react";
import { INVITE_ROLES, ROLE_LABELS } from "@/lib/roles";
import { addMember, type InviteState } from "./actions";

export function AddMemberForm({
  schoolId,
  allowSchoolAdmin,
}: {
  schoolId: string;
  allowSchoolAdmin: boolean;
}) {
  const [state, action, pending] = useActionState<InviteState, FormData>(addMember, {});

  return (
    <form action={action} className="auth-form invite-form">
      <input name="schoolId" type="hidden" value={schoolId} />
      <label>
        Full name
        <input autoComplete="off" maxLength={255} name="name" type="text" />
        <small>Needed for a new account. Leave it empty for someone who already has one.</small>
      </label>
      <label>
        Email
        <input autoComplete="off" maxLength={254} name="email" required type="email" />
      </label>
      <label>
        First password
        <input autoComplete="new-password" maxLength={128} minLength={12} name="password" type="password" />
        <small>At least 12 characters. Tell the person; they can change it after signing in.</small>
      </label>
      <label>
        School role
        <select name="role" required defaultValue="teacher">
          {INVITE_ROLES.filter((role) => allowSchoolAdmin || role !== "school_admin").map((role) => (
            <option key={role} value={role}>{ROLE_LABELS[role]}</option>
          ))}
        </select>
      </label>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.success && <p className="auth-success" role="status">{state.success}</p>}
      <button className="primary-button auth-submit" disabled={pending} type="submit">
        {pending ? "Adding..." : "Add to the team"}
      </button>
    </form>
  );
}
