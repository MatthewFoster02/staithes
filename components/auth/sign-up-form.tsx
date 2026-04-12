"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signUpAction, type AuthActionResult } from "@/lib/auth/actions";

export function SignUpForm() {
  const [state, action, pending] = useActionState<AuthActionResult | null, FormData>(
    signUpAction,
    null,
  );
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  if (state?.ok && state.needsConfirmation) {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-xl font-semibold">Check your email</h2>
        <p className="text-sm text-neutral-600">
          We&rsquo;ve sent you a confirmation link. Click it to verify your email and
          finish signing up.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="firstName" className="text-sm font-medium">
            First name
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            autoComplete="given-name"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          {fieldErrors?.firstName && (
            <p className="text-xs text-red-600">{fieldErrors.firstName[0]}</p>
          )}
        </div>
        <div className="space-y-1">
          <label htmlFor="lastName" className="text-sm font-medium">
            Last name
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            required
            autoComplete="family-name"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          {fieldErrors?.lastName && (
            <p className="text-xs text-red-600">{fieldErrors.lastName[0]}</p>
          )}
        </div>
      </div>
      <div className="space-y-1">
        <label htmlFor="signup-email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="signup-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        {fieldErrors?.email && (
          <p className="text-xs text-red-600">{fieldErrors.email[0]}</p>
        )}
      </div>
      <div className="space-y-1">
        <label htmlFor="signup-password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="signup-password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        {fieldErrors?.password && (
          <p className="text-xs text-red-600">{fieldErrors.password[0]}</p>
        )}
        <p className="text-xs text-neutral-500">At least 8 characters.</p>
      </div>
      {state && !state.ok && !fieldErrors && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-sm text-neutral-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-neutral-900 underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
