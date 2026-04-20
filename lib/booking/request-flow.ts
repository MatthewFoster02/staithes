import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/client";
import { siteUrl } from "@/lib/seo/site";
import { cancelBooking } from "@/lib/booking/cancel";
import { sendBookingRequestApprovedEmail } from "@/lib/email/booking";

const { Decimal } = Prisma;

// When a host approves a request-to-book booking, the guest has 24
// hours to pay before the Stripe session expires. That's longer than
// the 30-minute instant-booking window because the guest might miss
// the approval email, check it later, etc.
const APPROVAL_PAYMENT_TTL_HOURS = 24;

export type ApproveRequestResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; error: string; status: number };

// Creates a Stripe Checkout Session for an already-created booking
// (one that was put into "request" mode because the property has
// instantBookingEnabled=false). Sets approvedAt on the booking and
// emails the guest the payment link.
export async function approveRequest(bookingId: string): Promise<ApproveRequestResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      guest: true,
      property: { select: { name: true, currency: true } },
      priceSnapshot: true,
    },
  });
  if (!booking) return { ok: false, error: "Booking not found", status: 404 };
  if (booking.bookingType !== "request") {
    return { ok: false, error: "Only request bookings can be approved", status: 400 };
  }
  if (booking.status !== "pending") {
    return { ok: false, error: `Booking is ${booking.status}, can't approve`, status: 400 };
  }

  const snapshot = booking.priceSnapshot;
  if (!snapshot) {
    return { ok: false, error: "Booking has no price snapshot", status: 500 };
  }

  const lineItems: { name: string; description?: string; amountPence: number }[] = [
    {
      name: booking.property.name,
      description: `${snapshot.numNights} ${snapshot.numNights === 1 ? "night" : "nights"}`,
      amountPence: toPence(snapshot.subtotalAccommodation),
    },
  ];
  if (new Decimal(snapshot.cleaningFee).gt(0)) {
    lineItems.push({ name: "Cleaning fee", amountPence: toPence(snapshot.cleaningFee) });
  }
  if (new Decimal(snapshot.extraGuestFeeTotal).gt(0)) {
    lineItems.push({ name: "Extra guests", amountPence: toPence(snapshot.extraGuestFeeTotal) });
  }
  if (new Decimal(snapshot.discountAmount).gt(0)) {
    lineItems.push({
      name: snapshot.discountDescription ?? "Discount",
      amountPence: -toPence(snapshot.discountAmount),
    });
  }

  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: booking.guest.email,
      // Stripe disallows negative unit_amount entries in a single
      // session — discount is folded into the accommodation line so
      // we never send a negative item.
      line_items: foldDiscount(lineItems).map((item) => ({
        quantity: 1,
        price_data: {
          currency: booking.currency.toLowerCase(),
          unit_amount: item.amountPence,
          product_data: {
            name: item.name,
            ...(item.description ? { description: item.description } : {}),
          },
        },
      })),
      metadata: { booking_id: booking.id },
      payment_intent_data: { metadata: { booking_id: booking.id } },
      success_url: `${siteUrl()}/booking/success?booking_id=${booking.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/booking/cancel?booking_id=${booking.id}`,
      expires_at:
        Math.floor(Date.now() / 1000) + APPROVAL_PAYMENT_TTL_HOURS * 60 * 60,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe session creation failed";
    return { ok: false, error: message, status: 502 };
  }

  if (!session.url) {
    return { ok: false, error: "Stripe returned no session URL", status: 500 };
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: { approvedAt: new Date() },
  });

  // Fire the payment-link email. Failure isn't fatal — the host can
  // share the URL manually.
  try {
    await sendBookingRequestApprovedEmail({
      bookingId: booking.id,
      guestEmail: booking.guest.email,
      guestFirstName: booking.guest.firstName,
      propertyName: booking.property.name,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      totalPrice: new Decimal(booking.totalPrice).toFixed(2),
      currency: booking.currency,
      paymentUrl: session.url,
    });
  } catch (err) {
    console.error(`[request] approval email send failed for ${booking.id}:`, err);
  }

  return { ok: true, checkoutUrl: session.url };
}

// Declining is just a cancellation with canceller="host" and a
// specific reason. Reuses the existing cancellation flow — which
// no-ops the refund since the booking hasn't been charged yet.
export async function declineRequest(
  bookingId: string,
  reason?: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const result = await cancelBooking({
    bookingId,
    canceller: "host",
    reason: reason ?? "host declined the request",
  });
  if (!result.ok) {
    const status = result.error === "not_found" ? 404 : 400;
    return { ok: false, error: result.message, status };
  }
  return { ok: true };
}

// Accept Decimal or string and return integer pence.
function toPence(value: Prisma.Decimal | string): number {
  return new Decimal(value).mul(100).toDecimalPlaces(0).toNumber();
}

// Folds a negative discount line into the first positive line so the
// Stripe session only has positive line items. Keeps the total
// correct without Stripe complaining.
function foldDiscount(items: { name: string; description?: string; amountPence: number }[]) {
  const total = items.reduce((sum, i) => sum + i.amountPence, 0);
  const positive = items.filter((i) => i.amountPence >= 0);
  if (positive.length === items.length) return items;
  // Proportionally distribute the negative into the positives.
  const positiveSum = positive.reduce((s, i) => s + i.amountPence, 0);
  if (positiveSum === 0) return items;
  const scale = total / positiveSum;
  return positive.map((i) => ({
    ...i,
    amountPence: Math.round(i.amountPence * scale),
  }));
}
