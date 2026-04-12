import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = {
  title: "Create an account",
};

export default function SignUpPage() {
  return (
    <section className="mx-auto flex min-h-[60vh] w-full max-w-sm flex-col justify-center px-6 py-12">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Create an account</h1>
      <SignUpForm />
    </section>
  );
}
