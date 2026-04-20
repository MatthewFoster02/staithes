import { Prisma } from "@/lib/generated/prisma/client";
import type { CancellationPolicy } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/client";
import { differenceInDays, todayUTC } from "@/lib/availability/dates";
import { sendBookingCancelledEmail } from "@/lib/email/booking";

const { Decimal } = Prisma;
type Decimal = Prisma.Decimal;

export type CancellerKind = "guest" | "host" | "system";

export interface CancelBookingArgs {
  bookingId: string;
  /** Who is initiating the cancellation — drives both auth checks
   *  elsewhere and email wording. */
  canceller: CancellerKind;
  /** Optional free-text reason stored on the booking row and shown
   *  in the cancellation email. */
  reason?: string;
}

export type CancelBookingResult =
  | {
      ok: true;
      refundAmount: string;
      refundReason: string;
      alreadyCancelled: boolean;
    }
  | { ok: false; error: CancelError; message: string };

export type CancelError =
  | "not_found"
  | "already_cancelled"
  | "too_late"
  | "no_charge_found"
  | "stripe_refund_failed";

interface RefundCalc {
  amount: Decimal;
  reason: string;
}

// Policy tiers from the data-model doc, encoded as pairs of
// (daysUntilCheckIn-threshold, refund-percentage). The first matching
// row wins. Below the last row means no refund.
const POLICY_TIERS: Record<CancellationPolicy, { minDays: number; percent: number; label: string }[]> = {
  flexible: [
    { minDays: 1, percent: 100, label: "full refund (at least 24h notice)" },
  ],
  moderate: [
    { minDays: 5, percent: 100, label: "full refund (at least 5 days notice)" },
    { minDays: 3, percent: 50, label: "50% refund (3–5 days notice)" },
  ],
  strict: [
    { minDays: 14, percent: 100, label: "full refund (at least 14 days notice)" },
    { minDays: 7, percent: 50, label: "50% refund (7–14 days notice)" },
  ],
};

// Exposed for the UI — shows the user the expected refund before
// they confirm. The server re-computes authoritatively in
// cancelBooking, so the client value is cosmetic.
export function previewRefund(
  totalPrice: Decimal,
  policy: CancellationPolicy,
  daysUntilCheckIn: number,
): { amount: string; reason: string } {
  const { amount, reason } = computeRefund(totalPrice, policy, daysUntilCheckIn);
  return { amount: amount.toFixed(2), reason };
}

function computeRefund(
  totalPrice: Decimal,
  policy: CancellationPolicy,
  daysUntilCheckIn: number,
): RefundCalc {
  for (const tier of POLICY_TIERS[policy]) {
    if (daysUntilCheckIn >= tier.minDays) {
      return {
        amount: totalPrice.mul(tier.percent).div(100),
        reason: tier.label,
      };
    }
  }
  return {
    amount: new Decimal(0),
    reason: `no refund — ${policy} policy requires more notice`,
  };
}

// Cancels a booking, refunds the appropriate amount via Stripe, and
// records a Payment row of type=refund. Idempotent: cancelling an
// already-cancelled booking is a successful no-op.
//
// The order of operations is: update the DB first (cancel + insert a
// pending refund row in a single transaction), THEN call Stripe, THEN
// mark the refund row completed. This mirrors the "claim before side
// effect" pattern we use elsewhere: if Stripe fails, the refund row
// stays in `pending` status and the admin can retry.
export async function cancelBooking(args: CancelBookingArgs): Promise<CancelBookingResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: args.bookingId },
    include: {
      guest: true,
      property: { select: { name: true } },
      payments: { where: { type: "charge", status: "completed" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!booking) {
    return { ok: false, error: "not_found", message: "Booking not found." };
  }
  if (booking.status === "cancelled") {
    return {
      ok: true,
      refundAmount: "0.00",
      refundReason: "already cancelled",
      alreadyCancelled: true,
    };
  }
  if (booking.status === "completed" || booking.checkOut <= todayUTC()) {
    return {
      ok: false,
      error: "too_late",
      message: "This booking has already ended — it can't be cancelled.",
    };
  }

  const snapshot = booking.cancellationPolicySnapshot as Prisma.JsonObject;
  const policy = (snapshot?.policy as CancellationPolicy) ?? "moderate";
  const daysUntilCheckIn = Math.max(0, differenceInDays(booking.checkIn, todayUTC()));

  // Pending bookings haven't been charged; cancelling them is a
  // simple status flip with no money to return.
  if (booking.status === "pending") {
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
        cancellationReason: args.reason ?? `cancelled by ${args.canceller}`,
      },
    });
    await tryEmail({
      booking,
      canceller: args.canceller,
      refundAmount: "0.00",
      refundReason: "no payment taken",
      reason: args.reason,
    });
    return {
      ok: true,
      refundAmount: "0.00",
      refundReason: "no payment taken — pending booking",
      alreadyCancelled: false,
    };
  }

  // Confirmed booking: compute refund, mark cancelled + create
  // refund row, then hit Stripe.
  const totalPrice = new Decimal(booking.totalPrice);
  const { amount: refundAmount, reason: refundReason } = computeRefund(
    totalPrice,
    policy,
    daysUntilCheckIn,
  );
  const charge = booking.payments[0] ?? null;

  // If there's a refund to issue but we can't find the original
  // charge, that's an actionable error the admin needs to see.
  if (refundAmount.gt(0) && !charge?.gatewayTransactionId) {
    return {
      ok: false,
      error: "no_charge_found",
      message: "Couldn't find the original payment to refund against.",
    };
  }

  const refundPaymentId = await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
        cancellationReason: args.reason ?? `cancelled by ${args.canceller}`,
      },
    });
    if (refundAmount.gt(0)) {
      const row = await tx.payment.create({
        data: {
          bookingId: booking.id,
          type: "refund",
          amount: refundAmount,
          currency: booking.currency,
          status: "pending",
          gateway: "stripe",
          refundReason: refundReason,
        },
      });
      return row.id;
    }
    return null;
  });

  if (refundAmount.gt(0) && refundPaymentId && charge?.gatewayTransactionId) {
    try {
      await stripe.refunds.create({
        payment_intent: charge.gatewayTransactionId,
        amount: Math.round(refundAmount.mul(100).toNumber()),
        metadata: { booking_id: booking.id, refund_payment_id: refundPaymentId },
      });
      await prisma.payment.update({
        where: { id: refundPaymentId },
        data: { status: "completed", completedAt: new Date() },
      });
    } catch (err) {
      // Leave the refund row in "pending" — the admin can retry via
      // the Stripe dashboard (or a future manual retry button).
      console.error(`[cancel] Stripe refund failed for booking ${booking.id}:`, err);
      return {
        ok: false,
        error: "stripe_refund_failed",
        message: "The booking was cancelled, but the refund failed — please retry from Stripe.",
      };
    }
  }

  await tryEmail({
    booking,
    canceller: args.canceller,
    refundAmount: refundAmount.toFixed(2),
    refundReason,
    reason: args.reason,
  });

  return {
    ok: true,
    refundAmount: refundAmount.toFixed(2),
    refundReason,
    alreadyCancelled: false,
  };
}

async function tryEmail(args: {
  booking: {
    id: string;
    checkIn: Date;
    checkOut: Date;
    currency: string;
    guest: { email: string; firstName: string };
    property: { name: string };
  };
  canceller: CancellerKind;
  refundAmount: string;
  refundReason: string;
  reason?: string;
}) {
  try {
    await sendBookingCancelledEmail({
      bookingId: args.booking.id,
      guestEmail: args.booking.guest.email,
      guestFirstName: args.booking.guest.firstName,
      propertyName: args.booking.property.name,
      checkIn: args.booking.checkIn,
      checkOut: args.booking.checkOut,
      canceller: args.canceller,
      refundAmount: args.refundAmount,
      refundReason: args.refundReason,
      currency: args.booking.currency,
      reason: args.reason,
    });
  } catch (err) {
    console.error(`[cancel] email send failed for booking ${args.booking.id}:`, err);
  }
}
