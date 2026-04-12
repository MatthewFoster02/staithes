import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side Supabase client for server components, route handlers,
// and server actions. Reads/writes auth cookies via the Next 16 cookies
// store. The setAll path is wrapped in try/catch because cookies are
// read-only inside server components — only route handlers, middleware,
// and server actions can mutate them. Failures here are expected and
// safe to swallow; the middleware refreshes sessions on every request
// so any missed write will be re-attempted on the next navigation.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Read-only context (server component) — middleware will
            // re-set the cookies on the next navigation.
          }
        },
      },
    },
  );
}

// Convenience: returns the currently signed-in user (or null), backed
// by the cookies in the request. Always uses getUser() rather than
// getSession() — getUser() round-trips to Supabase and re-validates
// the JWT, getSession() trusts whatever is in the cookie.
export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
