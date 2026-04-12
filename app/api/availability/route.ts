import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { checkAvailability } from "@/lib/availability/check";
import { parseISODate } from "@/lib/availability/dates";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    checkIn: searchParams.get("checkIn"),
    checkOut: searchParams.get("checkOut"),
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

  const result = await checkAvailability({
    propertyId: property.id,
    checkIn: parseISODate(parsed.data.checkIn),
    checkOut: parseISODate(parsed.data.checkOut),
  });

  return NextResponse.json(result);
}
