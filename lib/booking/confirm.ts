import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { sendBookingConfirmationEmail } from "@/lib/email/booking";

const { Decimal } = Prisma;

interface ConfirmBookingArgs {
  bookingId: string;
  paymentIntentId: string;
  amountTotalPence: number;
  currency: string;
  cardLastFour?: string | null;
  cardBrand?: string | null;
}

export type ConfirmBookingResult =
  | { ok: true; alreadyConfirmed: boolean }
  | { ok: false; error: string };

// Marks a pending booking as confirmed and writes a Payment row in
// a single transaction. Triggered by the Stripe checkout.session.completed
// webhook. Idempotent: if the booking is already confirmed (because
// the webhook was retried) the function is a no-op.
export async function confirmBooking(args: ConfirmBookingArgs): Promise<ConfirmBookingResult> {
  const { bookingId, paymentIntentId, amountTotalPence, currency, cardLastFour, cardBrand } = args;

  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { guest: true, property: { select: { name: true } } },
    });
    if (!booking) {
      return { ok: false as const, error: `Booking ${bookingId} not found` };
    }
    if (booking.status === "confirmed") {
      return { ok: true as const, alreadyConfirmed: true };
    }
    if (booking.status !== "pending") {
      return { ok: false as const, error: `Booking ${bookingId} is ${booking.status}, can't confirm` };
    }

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: "confirmed",
        confirmedAt: new Date(),
      },
    });

    await tx.payment.create({
      data: {
        bookingId,
        type: "charge",
        amount: new Decimal(amountTotalPence).div(100),
        currency: currency.toUpperCase(),
        status: "completed",
        gateway: "stripe",
        gatewayTransactionId: paymentIntentId,
        cardLastFour: cardLastFour ?? null,
        cardBrand: cardBrand ?? null,
        completedAt: new Date(),
      },
    });

    // Fire-and-forget email send. The stub doesn't await any
    // network IO, so awaiting here is fine. When the real Resend
    // implementation lands in 2.8 we can decide whether to await
    // (slower webhook ack but tighter feedback if email fails) or
    // background it (faster ack but harder to debug failures).
    await sendBookingConfirmationEmail({
      bookingId: booking.id,
      guestEmail: booking.guest.email,
      guestFirstName: booking.guest.firstName,
      propertyName: booking.property.name,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      totalPrice: booking.totalPrice.toFixed(2),
      currency: booking.currency,
    });

    return { ok: true as const, alreadyConfirmed: false };
  });
}

// Marks a pending booking as cancelled. Triggered by the Stripe
// checkout.session.expired webhook (and also reachable from the cron
// sweep in 2.10). Idempotent: cancelled and non-pending bookings
// are skipped silently.
export async function cancelPendingBooking(args: {
  bookingId: string;
  reason: string;
}): Promise<{ cancelled: boolean }> {
  const result = await prisma.booking.updateMany({
    where: { id: args.bookingId, status: "pending" },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
      cancellationReason: args.reason,
    },
  });
  return { cancelled: result.count > 0 };
}
