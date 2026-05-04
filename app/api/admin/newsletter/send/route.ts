import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { isHostEmail } from "@/lib/auth/host";
import { sendNewsletter } from "@/lib/email/newsletter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Sequential per-recipient sends could exceed the 10s default in a
// real list. 60s is plenty for hundreds.
export const maxDuration = 60;

const BodySchema = z.object({
  subject: z.string().min(3).max(200),
  bodyMarkdown: z.string().min(20).max(10000),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isHostEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await sendNewsletter(parsed.data);
  return NextResponse.json({ ok: true, ...result });
}
