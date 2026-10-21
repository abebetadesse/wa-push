"use client";

import { useActionState, type FormEvent, type ReactNode } from "react";

type FormState = { error?: string; success?: string };

/**
 * A <form> for a one-click server action (activate, publish, remove…). It shows the action's error
 * next to its button instead of failing with a blank HTTP 500, which a bare <form action> does when
 * the action throws in production.
 */
export function ActionForm({
  action,
  children,
  className,
  onSubmit,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  children: ReactNode;
  className?: string;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className={className} onSubmit={onSubmit}>
      {children}
      {state.error && <span className="action-error" role="alert">{state.error}</span>}
    </form>
  );
}
