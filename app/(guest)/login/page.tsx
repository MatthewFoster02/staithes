import type { Metadata } from "next";
import { SignInForm } from "@/components/auth/sign-in-form";
import { safeNext } from "@/lib/auth/safe-redirect";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next, "/dashboard");

  return (
    <section className="mx-auto flex min-h-[60vh] w-full max-w-sm flex-col justify-center px-6 py-12">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Sign in</h1>
      <SignInForm next={next} />
    </section>
  );
}
