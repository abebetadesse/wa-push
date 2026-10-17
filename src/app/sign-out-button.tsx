"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function signOut() {
    setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError("Sign out failed. Please try again.");
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Sign out request failed.", error);
      setError("Sign out failed. Please try again.");
    }
  }

  return (
    <span className="signout-wrap">
      <button className="signout-button" onClick={signOut} type="button">Sign out</button>
      {error && <span className="signout-error" role="alert">{error}</span>}
    </span>
  );
}
