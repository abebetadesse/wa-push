"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { withBasePath } from "@/lib/base-path";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setPending(true);
    try {
      const result = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: `${window.location.origin}${withBasePath("/reset-password")}`,
      });
      if (result.error) {
        setMessage("We could not process that request. Please try again later.");
        return;
      }
      setMessage("If this address belongs to an account, a password reset link will be sent.");
    } catch (error) {
      console.error("Password reset request failed.", error);
      setMessage("We could not process that request. Please try again later.");
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
        <h1>Reset your password</h1>
        <p className="auth-description">Enter your account email. We’ll send a secure reset link if it matches an account.</p>
        <form className="auth-form" method="post" onSubmit={submit}>
          <label>Email address<input autoComplete="email" maxLength={254} onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
          {message && <p className="auth-success" role="status">{message}</p>}
          <button className="primary-button auth-submit" disabled={pending} type="submit">{pending ? "Sending..." : "Send reset link"}</button>
        </form>
        <p className="auth-switch"><Link href="/login">Return to sign in</Link></p>
      </section>
    </main>
  );
}
