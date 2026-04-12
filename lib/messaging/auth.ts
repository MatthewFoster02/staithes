import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { isHostEmail } from "@/lib/auth/host";
import type { Viewer } from "@/lib/messaging/threads";

// Resolves the current viewer from the request cookies. Returns
// either a Viewer or a NextResponse to short-circuit the route on
// auth failure. Centralised so every messaging route handler does
// the same thing.
export async function resolveViewer(): Promise<
  { ok: true; viewer: Viewer } | { ok: false; response: NextResponse }
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not signed in" }, { status: 401 }),
    };
  }
  if (isHostEmail(user.email)) {
    return { ok: true, viewer: { kind: "host" } };
  }
  return { ok: true, viewer: { kind: "guest", guestId: user.id } };
}
