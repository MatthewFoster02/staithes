import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const property = await prisma.property.findFirst({
    include: {
      amenities: { include: { amenity: true } },
      photos: true,
    },
  });

  if (!property) {
    return NextResponse.json({ error: "No property found" }, { status: 404 });
  }

  return NextResponse.json(property);
}
