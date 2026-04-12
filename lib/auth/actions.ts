"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { siteUrl } from "@/lib/seo/site";

// ---------------------------------------------------------------------------
// Form schemas
// ---------------------------------------------------------------------------

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
});

const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const MagicLinkSchema = z.object({
  email: z.string().email(),
});

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type AuthActionResult =
  | { ok: true; needsConfirmation?: boolean }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function signUpAction(_prev: AuthActionResult | null, formData: FormData): Promise<AuthActionResult> {
  const parsed = SignupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the errors below.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const { email, password, firstName, lastName } = parsed.data;
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: firstName, last_name: lastName },
      emailRedirectTo: `${siteUrl()}/auth/callback`,
    },
  });

  if (error || !data.user) {
    return { ok: false, error: error?.message ?? "Could not create your account." };
  }

  // Mirror the auth user into the public.guests table so app-level
  // bookings/messages/reviews can FK against a stable id. Idempotent
  // upsert keyed on the auth user's UUID.
  await prisma.guest.upsert({
    where: { id: data.user.id },
    update: {},
    create: {
      id: data.user.id,
      email,
      firstName,
      lastName,
      isVerified: data.user.email_confirmed_at !== null,
    },
  });

  // If email confirmation is on, signUp returns a user without a
  // session — the guest needs to click the link in their email.
  // If confirmation is off, a session is set immediately.
  if (!data.session) {
    return { ok: true, needsConfirmation: true };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signInAction(_prev: AuthActionResult | null, formData: FormData): Promise<AuthActionResult> {
  const parsed = SignInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Email and password are required." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function magicLinkAction(_prev: AuthActionResult | null, formData: FormData): Promise<AuthActionResult> {
  const parsed = MagicLinkSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { ok: false, error: "Please enter a valid email." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback` },
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, needsConfirmation: true };
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
