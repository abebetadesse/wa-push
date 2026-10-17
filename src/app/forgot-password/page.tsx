import type { Metadata } from "next";
import { ForgotPasswordForm } from "./form";

export const metadata: Metadata = { title: "Reset password | Forma" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
