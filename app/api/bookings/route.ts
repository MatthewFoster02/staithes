import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { createBooking } from "@/lib/booking/create";
import { parseISODate } from "@/lib/availability/dates";
import { createSupabaseServerClient } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.number().int().min(1).max(20),
  children: z.number().int().min(0).max(20).optional(),
  guestMessage: z.string().max(1000).optional(),
  marketingOptIn: z.boolean().optional(),
});

export async function POST(request: Request) {
  // 1. Auth
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // 2. Parse body
  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // 3. Resolve guest + property
  const [guest, property] = await Promise.all([
    prisma.guest.findUnique({ where: { id: user.id } }),
    prisma.property.findFirst({ select: { id: true } }),
  ]);
  if (!guest) {
    return NextResponse.json({ error: "Guest profile not found" }, { status: 404 });
  }
  if (!property) {
    return NextResponse.json({ error: "No property configured" }, { status: 404 });
  }

  // 4a. Persist marketing opt-in alongside the booking. Done before
  // createBooking so a Stripe failure doesn't lose the consent — we
  // re-record on every booking, so a guest who originally opted out
  // can opt in next time without us touching the existing flag.
  if (parsed.data.marketingOptIn === true && !guest.marketingOptIn) {
    await prisma.guest.update({
      where: { id: guest.id },
      data: {
        marketingOptIn: true,
        marketingOptInAt: new Date(),
        // Lazy-allocate the unsubscribe token on first opt-in.
        unsubscribeToken:
          guest.unsubscribeToken ?? crypto.randomUUID().replace(/-/g, ""),
      },
    });
  }

  // 4. Create booking + Stripe session
  const result = await createBooking({
    propertyId: property.id,
    guestId: guest.id,
    guestEmail: guest.email,
    checkIn: parseISODate(parsed.data.checkIn),
    checkOut: parseISODate(parsed.data.checkOut),
    numAdults: parsed.data.adults,
    numChildren: parsed.data.children ?? 0,
    guestMessage: parsed.data.guestMessage,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ bookingId: result.bookingId, checkoutUrl: result.checkoutUrl });
}
