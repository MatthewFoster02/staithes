import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { calculatePrice } from "@/lib/pricing/calculate";
import { parseISODate } from "@/lib/availability/dates";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.coerce.number().int().min(1).max(20),
  children: z.coerce.number().int().min(0).max(20).optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    checkIn: searchParams.get("checkIn"),
    checkOut: searchParams.get("checkOut"),
    adults: searchParams.get("adults"),
    children: searchParams.get("children") ?? undefined,
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

  const result = await calculatePrice({
    propertyId: property.id,
    checkIn: parseISODate(parsed.data.checkIn),
    checkOut: parseISODate(parsed.data.checkOut),
    numAdults: parsed.data.adults,
    numChildren: parsed.data.children,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error, message: result.message }, { status: 400 });
  }

  return NextResponse.json(result.breakdown);
}
