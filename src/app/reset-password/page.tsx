import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "./form";

export const metadata: Metadata = { title: "Choose a new password | Forma" };

async function ResetPasswordContent({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  return <ResetPasswordForm token={token ?? ""} invalid={Boolean(error)} />;
}

export default function ResetPasswordPage(props: { searchParams: Promise<{ token?: string; error?: string }> }) {
  return <Suspense fallback={<main className="auth-page"><p>Loading password reset...</p></main>}><ResetPasswordContent {...props} /></Suspense>;
}
