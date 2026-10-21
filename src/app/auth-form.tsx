"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { withBasePath } from "@/lib/base-path";

const signInMessages: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Email or password is incorrect.",
  INVALID_EMAIL: "Enter your full email address, for example name@gmail.com.",
  PASSWORD_TOO_LONG: "That password is longer than allowed (128 characters).",
  EMAIL_NOT_VERIFIED: "Verify your email address before signing in.",
  BANNED_USER: "This account has been suspended. Contact your school administrator.",
  INVALID_ORIGIN: "Sign-in was blocked because this page's address isn't trusted by the server. Open the site at its usual https:// address and try again.",
  MISSING_OR_NULL_ORIGIN: "Sign-in was blocked by the browser's privacy settings. Reload the page and try again.",
};

// Each rejection gets its real reason, plus its code so a failure can be reported precisely.
function signInErrorMessage(error: { status?: number; code?: string; message?: string }) {
  if (error.status === 429) return "Too many sign-in attempts. Please wait a minute and try again.";
  // A server-side failure (for example the database refusing to save the session), not bad input.
  if (error.status && error.status >= 500) {
    return `The server couldn't complete sign-in. This isn't a problem with your details. Please try again later, and tell your administrator if it continues (error ${error.status}).`;
  }
  const known = error.code ? signInMessages[error.code] : undefined;
  if (known) return known;
  const detail = error.message || "The sign-in request was rejected.";
  return `${detail} (${[error.status, error.code].filter(Boolean).join(" ") || "no code"})`;
}

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
        email: email.trim().toLowerCase(),
        password,
        callbackURL: withBasePath("/"),
      });

      if (result.error) {
        console.error("Sign-in was rejected.", result.error);
        setError(signInErrorMessage(result.error));
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
              // The browser accepts "name@gmail"; the sign-in service needs a full domain such as
              // gmail.com, so check for it here instead of sending a request that will be rejected.
              pattern="[^@\s]+@[^@\s]+\.[^@\s]{2,}"
              placeholder="you@school.edu"
              required
              title="Enter your full email address, for example name@gmail.com"
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
