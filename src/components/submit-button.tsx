"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/**
 * Submit button for server-action forms: disables itself and shows a spinner while the action
 * runs, and can ask for confirmation first (for actions that remove access or data).
 */
export function SubmitButton({
  children,
  className = "secondary-button record-action",
  confirm,
  pendingLabel,
}: {
  children: ReactNode;
  className?: string;
  confirm?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      aria-busy={pending}
      className={className}
      disabled={pending}
      onClick={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
      type="submit"
    >
      {pending && <span className="button-spinner" aria-hidden="true" />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
