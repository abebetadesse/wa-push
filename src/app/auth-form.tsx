"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { withBasePath } from "@/lib/base-path";

export function AuthForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);

    try {
      const result = await authClient.signIn.email({
        email: email.trim(),
        password,
        callbackURL: withBasePath("/"),
      });

      if (result.error) {
        setError("Email or password is incorrect.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch (caughtError) {
      console.error("Authentication request failed.", caughtError);
      setError("Could not connect to the sign-in service. Please try again.");
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
        <p className="auth-eyebrow">WELCOME BACK</p>
        <h1>Sign in to Forma</h1>
        <p className="auth-description">Sign in to manage the school workspaces assigned to your account.</p>
        <form className="auth-form" onSubmit={submit}>
          <label>
            Email address
            <input
              autoComplete="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="primary-button auth-submit" disabled={pending} type="submit">
            {pending ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="auth-switch"><Link href="/forgot-password">Forgot your password?</Link></p>
        <p className="auth-note">Accounts are created by school invitation. Access is limited to your assigned school roles.</p>
      </section>
    </main>
  );
}
