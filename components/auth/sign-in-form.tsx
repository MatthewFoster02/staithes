"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signInAction, magicLinkAction, type AuthActionResult } from "@/lib/auth/actions";

export function SignInForm({ next }: { next?: string }) {
  const [passwordState, passwordAction, passwordPending] = useActionState<AuthActionResult | null, FormData>(
    signInAction,
    null,
  );
  const [magicState, magicAction, magicPending] = useActionState<AuthActionResult | null, FormData>(
    magicLinkAction,
    null,
  );

  return (
    <div className="space-y-8">
      <form action={passwordAction} className="space-y-4">
        {next && <input type="hidden" name="next" value={next} />}
        <div className="space-y-1">
          <label htmlFor="signin-email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="signin-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="signin-password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="signin-password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        {passwordState && !passwordState.ok && (
          <p className="text-sm text-red-600">{passwordState.error}</p>
        )}
        <Button type="submit" className="w-full" disabled={passwordPending}>
          {passwordPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-neutral-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-neutral-500">or</span>
        </div>
      </div>

      <form action={magicAction} className="space-y-3">
        <p className="text-sm text-neutral-600">
          Sign in with a magic link instead — we&rsquo;ll email you a one-time link.
        </p>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        {magicState && !magicState.ok && (
          <p className="text-sm text-red-600">{magicState.error}</p>
        )}
        {magicState && magicState.ok && (
          <p className="text-sm text-emerald-600">
            Check your email for the sign-in link.
          </p>
        )}
        <Button type="submit" variant="outline" className="w-full" disabled={magicPending}>
          {magicPending ? "Sending…" : "Email me a link"}
        </Button>
      </form>

      <p className="text-center text-sm text-neutral-600">
        Don&rsquo;t have an account?{" "}
        <Link
          href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
          className="font-medium text-neutral-900 underline-offset-4 hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
