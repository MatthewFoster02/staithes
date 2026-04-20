import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { isHostEmail } from "@/lib/auth/host";
import { cancelBooking } from "@/lib/booking/cancel";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  reason: z.string().max(500).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const isHost = isHostEmail(user.email);
  const booking = await prisma.booking.findUnique({
    where: { id },
    select: { id: true, guestId: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (!isHost && booking.guestId !== user.id) {
    // Deliberately 404 so we don't reveal whether the booking exists.
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const json = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await cancelBooking({
    bookingId: id,
    canceller: isHost ? "host" : "guest",
    reason: parsed.data.reason,
  });

  if (!result.ok) {
    const status = result.error === "not_found" ? 404 : 400;
    return NextResponse.json({ error: result.message }, { status });
  }

  return NextResponse.json({
    ok: true,
    refundAmount: result.refundAmount,
    refundReason: result.refundReason,
    alreadyCancelled: result.alreadyCancelled,
  });
}
