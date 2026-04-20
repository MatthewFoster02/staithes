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
  return { ok: true as const };
}

const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;
const EMAIL_BASIC = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PatchSchema = z.object({
  siteName: z.string().min(1).max(200).optional(),
  tagline: z.string().max(500).nullable().optional(),
  logoUrl: z.string().url().max(2000).nullable().optional(),
  primaryColour: z.string().regex(HEX_COLOUR).nullable().optional(),
  accentColour: z.string().regex(HEX_COLOUR).nullable().optional(),
  contactEmail: z.string().regex(EMAIL_BASIC).max(200).optional(),
  contactPhone: z.string().max(50).nullable().optional(),
  senderEmail: z.string().regex(EMAIL_BASIC).max(200).nullable().optional(),
  senderName: z.string().max(200).nullable().optional(),
  seoTitle: z.string().max(200).nullable().optional(),
  seoDescription: z.string().max(500).nullable().optional(),
  ogImageUrl: z.string().url().max(2000).nullable().optional(),
  analyticsId: z.string().max(100).nullable().optional(),
  timezone: z.string().min(1).max(100).optional(),
});

export async function PATCH(request: Request) {
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

  const existing = await prisma.siteConfiguration.findFirst({ select: { id: true } });
  if (!existing) {
    return NextResponse.json(
      { error: "No site configuration exists — seed one first." },
      { status: 404 },
    );
  }

  await prisma.siteConfiguration.update({
    where: { id: existing.id },
    data: parsed.data,
  });
  return NextResponse.json({ ok: true });
}
