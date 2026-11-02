"use client";

import { useActionState } from "react";
import { registerAccount } from "./actions";
import type { ActionState } from "@/lib/action-result";

export function RegisterForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(registerAccount, {});

  if (state.success) return <p className="auth-success" role="status">{state.success}</p>;

  return (
    <form action={action} className="auth-form" method="post">
      <label>
        Full name
        <input autoComplete="name" maxLength={255} name="name" required />
      </label>
      <label>
        Email address
        <input autoComplete="email" inputMode="email" maxLength={254} name="email" required type="email" />
      </label>
      <label>
        Password
        <input autoComplete="new-password" maxLength={128} minLength={12} name="password" required type="password" />
        <small>Use at least 12 characters.</small>
      </label>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      <button className="primary-button auth-submit" disabled={pending} type="submit">
        {pending ? "Sending..." : "Request an account"}
      </button>
    </form>
  );
}
