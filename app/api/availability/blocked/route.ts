import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { listBlockedDays } from "@/lib/availability/check";
import { addDays, parseISODate } from "@/lib/availability/dates";
import { todayUTC } from "@/lib/availability/check";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const property = await prisma.property.findFirst({ select: { id: true } });
  if (!property) {
    return NextResponse.json({ error: "No property configured" }, { status: 404 });
  }

  // Default range: today through today + 12 months. The calendar
  // typically only renders ~2 months at a time, but pre-fetching a
  // year keeps the response cacheable and avoids per-month chatter.
  const from = parsed.data.from ? parseISODate(parsed.data.from) : todayUTC();
  const to = parsed.data.to ? parseISODate(parsed.data.to) : addDays(todayUTC(), 365);

  const blocked = await listBlockedDays({
    propertyId: property.id,
    from,
    to,
  });

  return NextResponse.json({ blocked });
}
