import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "新規登録" };

export default function SignupPage() {
  return <AuthForm mode="signup" next="/" />;
}
