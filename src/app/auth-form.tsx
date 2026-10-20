"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { withBasePath } from "@/lib/base-path";

export function AuthForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  // Someone who is already signed in has nothing to do here; send them to their workspace.
  useEffect(() => {
    let cancelled = false;
    authClient.getSession().then((result) => {
      if (!cancelled && result.data?.session) router.replace("/");
    }).catch(() => {
      // Stay on the form; signing in will report any connection problem.
    });
    return () => { cancelled = true; };
  }, [router]);

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
        setError(result.error.status === 429
          ? "Too many sign-in attempts. Please wait a minute and try again."
          : "Email or password is incorrect.");
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
        <p className="auth-eyebrow">Welcome back</p>
        <h1>Sign in to Forma</h1>
        <p className="auth-description">Sign in to manage the school workspaces assigned to your account.</p>
        <form className="auth-form" onSubmit={submit}>
          <label>
            Email address
            <input
              autoComplete="email"
              autoFocus
              inputMode="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@school.edu"
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            <span className="label-row">Password <Link className="optional-label" href="/forgot-password">Forgot password?</Link></span>
            <span className="password-field">
              <input
                autoComplete="current-password"
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="password-toggle"
                onClick={() => setShowPassword((shown) => !shown)}
                type="button"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </span>
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="primary-button auth-submit" disabled={pending} type="submit">
            {pending && <span className="button-spinner" aria-hidden="true" />}
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="auth-note">Accounts are created by school invitation. <Link href="/register">How do I get access?</Link></p>
      </section>
    </main>
  );
}
