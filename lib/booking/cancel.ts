import { Prisma } from "@/lib/generated/prisma/client";
import type { BookingStatus, CancellationPolicy } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/client";
import { differenceInDays, todayUTC } from "@/lib/availability/dates";
import { sendBookingCancelledEmail } from "@/lib/email/booking";

const { Decimal } = Prisma;
type Decimal = Prisma.Decimal;

export type CancellerKind = "guest" | "host" | "system";

export interface CancelBookingArgs {
  bookingId: string;
  /** Who is initiating the cancellation — drives refund sizing,
   *  auth context elsewhere, and email wording. */
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
  | "host_blocked_during_stay"
  | "no_charge_found"
  | "stripe_refund_failed";

// Tier shape used by both the frozen snapshot and the default preset
// lookup. `minDays` is inclusive — a stay >= minDays from checkIn
// matches. The first (highest minDays) tier wins; below the last tier
// there is no refund.
export interface RefundTier {
  minDays: number;
  percent: number;
}

interface RefundCalc {
  amount: Decimal;
  reason: string;
}

// Preset tiers used when a property hasn't set custom tiers. Kept here
// so the frontend preset buttons (on the property edit form) have a
// single source of truth.
export const PRESET_TIERS: Record<CancellationPolicy, RefundTier[]> = {
  flexible: [{ minDays: 1, percent: 100 }],
  moderate: [
    { minDays: 5, percent: 100 },
    { minDays: 3, percent: 50 },
  ],
  strict: [
    { minDays: 14, percent: 100 },
    { minDays: 7, percent: 50 },
  ],
};

export function tiersFromPolicy(policy: CancellationPolicy): RefundTier[] {
  return PRESET_TIERS[policy];
}

// Describes the outcome of a tier match in plain English. Kept
// standalone so the preview dialog and the cancellation email both
// phrase things the same way.
export function describeTier(tier: RefundTier | null, policyLabel: string): string {
  if (!tier) return `no refund — ${policyLabel} policy requires more notice`;
  if (tier.percent === 100) {
    return `full refund (at least ${tier.minDays} day${tier.minDays === 1 ? "" : "s"} notice)`;
  }
  return `${tier.percent}% refund (at least ${tier.minDays} day${tier.minDays === 1 ? "" : "s"} notice)`;
}

function tiersFromSnapshot(snapshot: Prisma.JsonValue | null): RefundTier[] {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return tiersFromPolicy("moderate");
  }
  const obj = snapshot as Prisma.JsonObject;
  const raw = obj.tiers;
  if (Array.isArray(raw)) {
    // Defensive: guard each row's shape before coercing.
    const parsed: RefundTier[] = [];
    for (const row of raw) {
      if (
        row &&
        typeof row === "object" &&
        !Array.isArray(row) &&
        typeof (row as Prisma.JsonObject).minDays === "number" &&
        typeof (row as Prisma.JsonObject).percent === "number"
      ) {
        parsed.push({
          minDays: (row as Prisma.JsonObject).minDays as number,
          percent: (row as Prisma.JsonObject).percent as number,
        });
      }
    }
    if (parsed.length > 0) return sortTiers(parsed);
  }
  const policy = obj.policy;
  if (policy === "flexible" || policy === "moderate" || policy === "strict") {
    return tiersFromPolicy(policy);
  }
  return tiersFromPolicy("moderate");
}

// Tiers are iterated in descending minDays so the first match wins.
export function sortTiers(tiers: RefundTier[]): RefundTier[] {
  return [...tiers].sort((a, b) => b.minDays - a.minDays);
}

function policyLabelFromSnapshot(snapshot: Prisma.JsonValue | null): string {
  if (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)) {
    const policy = (snapshot as Prisma.JsonObject).policy;
    if (typeof policy === "string") return policy;
  }
  return "the agreed";
}

function computeRefund(
  totalPrice: Decimal,
  tiers: RefundTier[],
  daysUntilCheckIn: number,
  policyLabel: string,
): RefundCalc {
  for (const tier of sortTiers(tiers)) {
    if (daysUntilCheckIn >= tier.minDays) {
      return {
        amount: totalPrice.mul(tier.percent).div(100),
        reason: describeTier(tier, policyLabel),
      };
    }
  }
  return {
    amount: new Decimal(0),
    reason: describeTier(null, policyLabel),
  };
}

// Common shape used by previewRefund and cancelBooking. Taking this
// directly from a Prisma booking row keeps the logic in one place.
export interface PreviewBooking {
  totalPrice: Decimal;
  status: BookingStatus;
  checkIn: Date;
  checkOut: Date;
  cancellationPolicySnapshot: Prisma.JsonValue;
}

// Exposed for the UI — shows the user the expected refund before
// they confirm. The server re-computes authoritatively in
// cancelBooking, so the client value is cosmetic.
//
// Business rules that short-circuit the tiers:
// - pending bookings refund 0 (no charge taken yet)
// - host cancellations always refund 100% (the host is the one
//   backing out, not the guest)
// - bookings whose check-out is already in the past can't be cancelled
export function previewRefund(
  booking: PreviewBooking,
  canceller: CancellerKind,
): { amount: string; reason: string } {
  const totalPrice = new Decimal(booking.totalPrice);
  const today = todayUTC();
  if (booking.checkOut <= today) {
    return { amount: "0.00", reason: "the stay has already ended" };
  }
  if (booking.status === "pending") {
    return { amount: "0.00", reason: "no payment taken yet" };
  }
  if (canceller === "host") {
    return {
      amount: totalPrice.toFixed(2),
      reason: "full refund — host-initiated cancellation",
    };
  }
  const daysUntilCheckIn = Math.max(0, differenceInDays(booking.checkIn, today));
  const tiers = tiersFromSnapshot(booking.cancellationPolicySnapshot);
  const policyLabel = policyLabelFromSnapshot(booking.cancellationPolicySnapshot);
  const { amount, reason } = computeRefund(totalPrice, tiers, daysUntilCheckIn, policyLabel);
  return { amount: amount.toFixed(2), reason };
}

// Whether a canceller is allowed to cancel now. The UI uses this to
// decide whether to show the cancel button; the API re-checks.
export function canCancel(booking: PreviewBooking, canceller: CancellerKind): boolean {
  const today = todayUTC();
  if (booking.status !== "pending" && booking.status !== "confirmed") return false;
  if (booking.checkOut <= today) return false;
  // Host can't pull the rug out from under a guest mid-stay — once
  // the guest has checked in, only the guest can cancel. The host
  // can of course still contact the guest directly to negotiate.
  if (canceller === "host" && booking.status === "confirmed" && booking.checkIn <= today) {
    return false;
  }
  return true;
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
  if (
    args.canceller === "host" &&
    booking.status === "confirmed" &&
    booking.checkIn <= todayUTC()
  ) {
    return {
      ok: false,
      error: "host_blocked_during_stay",
      message:
        "The guest has already checked in — contact them directly, or ask them to cancel on their end.",
    };
  }

  // Pending bookings haven't been charged; cancelling them is a
  // simple status flip with no money to return. This applies to both
  // instant-mode (Stripe session expired before payment) and request-
  // mode bookings (awaiting host approval or awaiting payment).
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
      refundReason: "no payment taken yet",
      reason: args.reason,
    });
    return {
      ok: true,
      refundAmount: "0.00",
      refundReason: "no payment taken yet",
      alreadyCancelled: false,
    };
  }

  // Confirmed booking: figure out the refund.
  const totalPrice = new Decimal(booking.totalPrice);
  let refundAmount: Decimal;
  let refundReason: string;
  if (args.canceller === "host") {
    refundAmount = totalPrice;
    refundReason = "full refund — host-initiated cancellation";
  } else {
    const tiers = tiersFromSnapshot(booking.cancellationPolicySnapshot);
    const policyLabel = policyLabelFromSnapshot(booking.cancellationPolicySnapshot);
    const daysUntilCheckIn = Math.max(0, differenceInDays(booking.checkIn, todayUTC()));
    const calc = computeRefund(totalPrice, tiers, daysUntilCheckIn, policyLabel);
    refundAmount = calc.amount;
    refundReason = calc.reason;
  }
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
