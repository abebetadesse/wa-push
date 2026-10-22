"use client";

import { useActionState } from "react";
import { INVITE_ROLES, ROLE_LABELS } from "@/lib/roles";
import { inviteMember, type InviteState } from "./actions";

export function InviteForm({
  schoolId,
  allowSchoolAdmin,
}: {
  schoolId: string;
  allowSchoolAdmin: boolean;
}) {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteMember, {});

  return (
    <form action={action} className="auth-form invite-form">
      <input name="schoolId" type="hidden" value={schoolId} />
      <label>
        Work email
        <input autoComplete="email" maxLength={254} name="email" required type="email" />
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
        {pending ? "Sending invitation..." : "Send invitation"}
      </button>
    </form>
  );
}
