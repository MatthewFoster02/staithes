import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { isHostEmail } from "@/lib/auth/host";
import { parseISODate } from "@/lib/availability/dates";

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

// Each rule type has a different required field set. We zod-parse into
// one permissive shape then apply per-type validation before insert.
const BaseSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum([
    "seasonal",
    "day_of_week",
    "last_minute",
    "early_bird",
    "length_discount",
  ]),
  priority: z.coerce.number().int().min(0).max(1000).default(0),
  isActive: z.boolean().default(true),
  dateStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  dateEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  nightlyRate: z.coerce.number().positive().nullable().optional(),
  rateMultiplier: z.coerce.number().positive().nullable().optional(),
  minNightsForDiscount: z.coerce.number().int().min(1).nullable().optional(),
  discountPercent: z.coerce.number().min(0).max(100).nullable().optional(),
  daysBeforeCheckin: z.coerce.number().int().min(1).nullable().optional(),
  daysAdvanceBooking: z.coerce.number().int().min(1).nullable().optional(),
});

function validateByType(
  data: z.infer<typeof BaseSchema>,
): { ok: true } | { ok: false; message: string } {
  switch (data.type) {
    case "seasonal":
      if (!data.dateStart || !data.dateEnd)
        return { ok: false, message: "Seasonal rules need a start and end date." };
      if (data.nightlyRate == null && data.rateMultiplier == null)
        return { ok: false, message: "Set either a nightly rate or a multiplier." };
      return { ok: true };
    case "day_of_week":
      if (!data.daysOfWeek || data.daysOfWeek.length === 0)
        return { ok: false, message: "Pick at least one day of the week." };
      if (data.nightlyRate == null && data.rateMultiplier == null)
        return { ok: false, message: "Set either a nightly rate or a multiplier." };
      return { ok: true };
    case "last_minute":
      if (data.daysBeforeCheckin == null)
        return { ok: false, message: "Set the days-before-check-in window." };
      if (data.discountPercent == null)
        return { ok: false, message: "Set a discount percent." };
      return { ok: true };
    case "early_bird":
      if (data.daysAdvanceBooking == null)
        return { ok: false, message: "Set the days-in-advance threshold." };
      if (data.discountPercent == null)
        return { ok: false, message: "Set a discount percent." };
      return { ok: true };
    case "length_discount":
      if (data.minNightsForDiscount == null)
        return { ok: false, message: "Set the minimum nights threshold." };
      if (data.discountPercent == null)
        return { ok: false, message: "Set a discount percent." };
      return { ok: true };
  }
}

export async function GET() {
  const auth = await requireHost();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rules = await prisma.pricingRule.findMany({
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ rules });
}

export async function POST(request: Request) {
  const auth = await requireHost();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const json = await request.json().catch(() => null);
  const parsed = BaseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const typeCheck = validateByType(parsed.data);
  if (!typeCheck.ok) {
    return NextResponse.json({ error: typeCheck.message }, { status: 400 });
  }

  const property = await prisma.property.findFirst({ select: { id: true } });
  if (!property) {
    return NextResponse.json({ error: "No property configured" }, { status: 404 });
  }

  const created = await prisma.pricingRule.create({
    data: {
      propertyId: property.id,
      name: parsed.data.name,
      type: parsed.data.type,
      priority: parsed.data.priority,
      isActive: parsed.data.isActive,
      dateStart: parsed.data.dateStart ? parseISODate(parsed.data.dateStart) : null,
      dateEnd: parsed.data.dateEnd ? parseISODate(parsed.data.dateEnd) : null,
      daysOfWeek: parsed.data.daysOfWeek ?? [],
      nightlyRate: parsed.data.nightlyRate ?? null,
      rateMultiplier: parsed.data.rateMultiplier ?? null,
      minNightsForDiscount: parsed.data.minNightsForDiscount ?? null,
      discountPercent: parsed.data.discountPercent ?? null,
      daysBeforeCheckin: parsed.data.daysBeforeCheckin ?? null,
      daysAdvanceBooking: parsed.data.daysAdvanceBooking ?? null,
    },
  });

  return NextResponse.json({ id: created.id });
}
