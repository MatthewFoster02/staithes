import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/db/prisma";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { isHostEmail } from "@/lib/auth/host";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function requireHost() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Not signed in" };
  if (!isHostEmail(user.email)) return { ok: false as const, status: 403, error: "Forbidden" };
  return { ok: true as const };
}

const PatchSchema = z.object({
  sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
  altText: z.string().min(1).max(200).optional(),
  category: z.enum(["exterior", "living", "bedroom", "kitchen", "bathroom", "garden", "other"]).optional(),
  caption: z.string().max(500).nullable().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireHost();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const existing = await prisma.propertyPhoto.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.propertyPhoto.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireHost();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await context.params;
  const photo = await prisma.propertyPhoto.findUnique({ where: { id } });
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Delete the DB row first, then the Storage object. If Storage
  // delete fails we log and carry on — an orphaned file is better
  // than a dangling row pointing at a deleted URL.
  await prisma.propertyPhoto.delete({ where: { id } });
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
    await supabase.storage.from("property-photos").remove([photo.url]);
  } catch (err) {
    console.error(`[admin/photos] storage delete failed for ${photo.url}:`, err);
  }
  return NextResponse.json({ ok: true });
}
