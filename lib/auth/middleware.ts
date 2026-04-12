import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/messages", "/admin"];
const AUTH_ONLY_PAGES = ["/login", "/signup"];

// Runs on every request matched by middleware.ts. Two jobs:
//
// 1. Refresh the Supabase session cookie. Auth tokens are short-lived
//    and need re-rotating; doing it here means every server-side
//    Supabase call after this point sees a fresh JWT.
// 2. Gate protected routes. Anonymous visitors hitting /dashboard
//    (or anything else under PROTECTED_PREFIXES) are bounced to
//    /login. Conversely, signed-in users on /login are redirected to
//    /dashboard.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Re-validates the JWT and refreshes if needed. Must be the first
  // thing after creating the client — calling response logic before
  // this means a stale session in this request.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthOnly = AUTH_ONLY_PAGES.some((p) => pathname.startsWith(p));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthOnly) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
