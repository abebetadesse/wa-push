"use client";

import { useActionState, type ReactNode } from "react";

type FormState = { error?: string; success?: string };

/** A server-action form for larger editors (grids, matrices) that shows the action's error or success under it. */
export function StatusForm({ action, children, className }: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className={className}>
      {children}
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.success && <p className="auth-success" role="status">{state.success}</p>}
    </form>
  );
}
