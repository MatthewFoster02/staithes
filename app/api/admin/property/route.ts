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

// All-fields partial patch. Missing fields stay untouched. `type`
// fields use Zod enums to reject nonsense values. Decimal fields
// accept numeric input and Prisma converts at insert time.
const PatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().min(1).optional(),
  shortDescription: z.string().max(500).nullable().optional(),
  propertyType: z.enum(["house", "flat", "cottage", "cabin", "other"]).optional(),
  addressFull: z.string().min(1).optional(),
  addressApprox: z.string().min(1).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  maxGuests: z.coerce.number().int().min(1).max(50).optional(),
  bedrooms: z.coerce.number().int().min(0).max(50).optional(),
  beds: z.coerce.number().int().min(0).max(50).optional(),
  bathrooms: z.coerce.number().min(0).max(50).optional(),
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  minStayDefault: z.coerce.number().int().min(1).optional(),
  maxStay: z.coerce.number().int().min(1).nullable().optional(),
  baseNightlyRate: z.coerce.number().min(0).optional(),
  cleaningFee: z.coerce.number().min(0).optional(),
  extraGuestFee: z.coerce.number().min(0).optional(),
  baseGuestCount: z.coerce.number().int().min(1).optional(),
  currency: z.string().length(3).optional(),
  houseRules: z.string().nullable().optional(),
  cancellationPolicy: z.enum(["flexible", "moderate", "strict"]).optional(),
  status: z.enum(["active", "paused", "hidden"]).optional(),
  instantBookingEnabled: z.boolean().optional(),
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

  const property = await prisma.property.findFirst({ select: { id: true } });
  if (!property) {
    return NextResponse.json({ error: "No property configured" }, { status: 404 });
  }

  await prisma.property.update({
    where: { id: property.id },
    data: parsed.data,
  });
  return NextResponse.json({ ok: true });
}
