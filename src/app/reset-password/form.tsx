"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordForm({ token, invalid }: { token: string; invalid: boolean }) {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(invalid || !token ? "This password reset link is invalid or expired. Request a new link." : "");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setMessage("");
    setPending(true);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) {
        setMessage("This password reset link is invalid or expired. Request a new link.");
        return;
      }
      setMessage("Your password has been changed. You can now sign in.");
      setPassword("");
    } catch (error) {
      console.error("Password reset failed.", error);
      setMessage("Could not reset the password. Request a new link and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="brand auth-brand" href="/" aria-label="Forma home">
          <span className="brand-mark">f</span><span>forma<span className="brand-dot">.</span></span>
        </Link>
        <p className="auth-eyebrow">ACCOUNT RECOVERY</p>
        <h1>Choose a new password</h1>
        {token && !invalid && (
          <form className="auth-form" method="post" onSubmit={submit}>
            <label>New password<input autoComplete="new-password" minLength={12} maxLength={128} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /><small>Use at least 12 characters.</small></label>
            <button className="primary-button auth-submit" disabled={pending} type="submit">{pending ? "Updating..." : "Update password"}</button>
          </form>
        )}
        {message && <p className="auth-success" role="status">{message}</p>}
        <p className="auth-switch"><Link href="/login">Return to sign in</Link></p>
      </section>
    </main>
  );
}
