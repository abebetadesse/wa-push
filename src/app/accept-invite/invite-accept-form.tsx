"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { withBasePath } from "@/lib/base-path";
import { acceptInvitationForCurrentUser } from "./actions";

export function InviteAcceptForm({
  email,
  role,
  schoolName,
  token,
}: {
  email: string;
  role: string;
  schoolName: string;
  token: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [existingPassword, setExistingPassword] = useState("");
  const [error, setError] = useState("");
  const [existingError, setExistingError] = useState("");
  const [pending, setPending] = useState(false);
  const [existingAccount, setExistingAccount] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const response = await fetch(withBasePath("/api/auth/sign-up/email"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-school-invitation-token": token,
        },
        body: JSON.stringify({
          name: name.trim(),
          email,
          password,
          callbackURL: withBasePath("/"),
        }),
      });
      if (!response.ok) {
        setError("The invitation could not be accepted. It may have expired or already been used.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch (caughtError) {
      console.error("Could not accept a school invitation.", caughtError);
      setError("Could not connect to the account service. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function acceptExistingAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setExistingError("");
    setPending(true);
    try {
      const signIn = await authClient.signIn.email({ email, password: existingPassword });
      if (signIn.error) {
        setExistingError("Sign in failed. Check your password or request a password reset.");
        return;
      }
      const result = await acceptInvitationForCurrentUser(token);
      if (result.error) {
        setExistingError(result.error);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch (caughtError) {
      console.error("Could not accept the invitation for this account.", caughtError);
      setExistingError("Could not accept the invitation. Please try again.");
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
        <p className="auth-eyebrow">SCHOOL INVITATION</p>
        <h1>Join {schoolName}</h1>
        <p className="auth-description">You were invited as a {role.replaceAll("_", " ")}. Create a password to accept.</p>
        {!existingAccount && <form className="auth-form" onSubmit={submit}>
          <label>
            Full name
            <input autoComplete="name" maxLength={255} onChange={(event) => setName(event.target.value)} required value={name} />
          </label>
          <label>
            Invited email
            <input autoComplete="email" readOnly type="email" value={email} />
          </label>
          <label>
            Password
            <input autoComplete="new-password" minLength={12} maxLength={128} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
            <small>Use at least 12 characters.</small>
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="primary-button auth-submit" disabled={pending} type="submit">
            {pending ? "Accepting invitation..." : "Create account"}
          </button>
        </form>}
        {existingAccount && <form className="auth-form" onSubmit={acceptExistingAccount}>
          <label>Account password<input autoComplete="current-password" onChange={(event) => setExistingPassword(event.target.value)} required type="password" value={existingPassword} /></label>
          {existingError && <p className="auth-error" role="alert">{existingError}</p>}
          <button className="primary-button auth-submit" disabled={pending} type="submit">{pending ? "Accepting invitation..." : "Sign in and accept"}</button>
        </form>}
        <p className="auth-switch"><button className="link-button" onClick={() => setExistingAccount((value) => !value)} type="button">{existingAccount ? "Create a new account instead" : "Already have a Forma account? Sign in to accept"}</button></p>
      </section>
    </main>
  );
}
