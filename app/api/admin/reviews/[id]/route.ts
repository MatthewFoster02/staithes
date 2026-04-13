import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { isHostEmail } from "@/lib/auth/host";

export const dynamic = "force-dynamic";

async function requireHost() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Not signed in" };
  if (!isHostEmail(user.email)) return { ok: false as const, status: 403, error: "Forbidden" };
  return { ok: true as const, user };
}

const PatchSchema = z.object({
  isPublished: z.boolean().optional(),
  hostResponse: z.string().max(2000).nullable().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireHost();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const json = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  const existing = await prisma.review.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Build the update object piecewise so omitted fields stay untouched.
  const data: {
    isPublished?: boolean;
    hostResponse?: string | null;
    hostRespondedAt?: Date | null;
  } = {};
  if (parsed.data.isPublished !== undefined) {
    data.isPublished = parsed.data.isPublished;
  }
  if (parsed.data.hostResponse !== undefined) {
    const trimmed = parsed.data.hostResponse?.trim() || null;
    data.hostResponse = trimmed;
    data.hostRespondedAt = trimmed ? new Date() : null;
  }

  await prisma.review.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}
