"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Shared body of the error boundaries: what happened, a retry, and a way home. */
export function ErrorPanel({ error, retry, inShell }: { error: unknown; retry: () => void; inShell: boolean }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = typeof error === "object" && error && "digest" in error ? String((error as { digest?: unknown }).digest ?? "") : "";
  const body = (
    <>
      <p className="auth-eyebrow">Something went wrong</p>
      <h1>We couldn’t complete that</h1>
      <p className={inShell ? "management-description" : "auth-description"}>
        The page hit an unexpected problem. Your saved data is safe. Try again, and if it keeps happening, share the reference below with your administrator.
      </p>
      {digest && <p className="optional-label">Reference: <code>{digest}</code></p>}
      <div className={inShell ? "inline-actions" : "no-access-actions"}>
        <button className="primary-button" onClick={retry} type="button">Try again</button>
        <Link className="secondary-button" href="/">Go to dashboard</Link>
      </div>
    </>
  );

  return inShell
    ? <main className="management-page"><section className="management-card status-card">{body}</section></main>
    : <main className="auth-page"><section className="auth-card">{body}</section></main>;
}
