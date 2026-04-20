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

// Partial patch — used by both the quick isActive toggle and the
// full edit form. `type` is intentionally not editable: changing a
// seasonal into a day-of-week mid-flight would need different
// required fields, so if you want a different type, delete + recreate.
const PatchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  priority: z.coerce.number().int().min(0).max(1000).optional(),
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

  const existing = await prisma.pricingRule.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Build the update object piecewise so omitted fields stay
  // untouched. Date strings are parsed to Date objects; explicit
  // nulls are passed through so you can, e.g., clear a nightlyRate.
  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
  if (parsed.data.priority !== undefined) data.priority = parsed.data.priority;
  if (parsed.data.dateStart !== undefined) {
    data.dateStart = parsed.data.dateStart ? parseISODate(parsed.data.dateStart) : null;
  }
  if (parsed.data.dateEnd !== undefined) {
    data.dateEnd = parsed.data.dateEnd ? parseISODate(parsed.data.dateEnd) : null;
  }
  if (parsed.data.daysOfWeek !== undefined) data.daysOfWeek = parsed.data.daysOfWeek;
  if (parsed.data.nightlyRate !== undefined) data.nightlyRate = parsed.data.nightlyRate;
  if (parsed.data.rateMultiplier !== undefined) data.rateMultiplier = parsed.data.rateMultiplier;
  if (parsed.data.minNightsForDiscount !== undefined)
    data.minNightsForDiscount = parsed.data.minNightsForDiscount;
  if (parsed.data.discountPercent !== undefined) data.discountPercent = parsed.data.discountPercent;
  if (parsed.data.daysBeforeCheckin !== undefined)
    data.daysBeforeCheckin = parsed.data.daysBeforeCheckin;
  if (parsed.data.daysAdvanceBooking !== undefined)
    data.daysAdvanceBooking = parsed.data.daysAdvanceBooking;

  await prisma.pricingRule.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireHost();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await context.params;
  const result = await prisma.pricingRule.deleteMany({ where: { id } });
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
