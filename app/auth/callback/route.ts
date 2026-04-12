import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/server";

// Handles email confirmation links and magic-link sign-ins. Supabase
// sends users here with a `?code=...` query param; we exchange the
// code for a session, then redirect to either `next` or the dashboard.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
