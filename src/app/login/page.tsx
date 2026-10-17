import type { Metadata } from "next";
import { AuthForm } from "@/app/auth-form";

export const metadata: Metadata = {
  title: "Sign in | Forma",
};

export default function LoginPage() {
  return <AuthForm />;
}
