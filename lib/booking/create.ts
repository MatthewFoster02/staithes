import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/client";
import { withPropertyLock } from "@/lib/availability/lock";
import { checkAvailability } from "@/lib/availability/check";
import { calculatePrice } from "@/lib/pricing/calculate";
import { siteUrl } from "@/lib/seo/site";

const { Decimal } = Prisma;

export interface CreateBookingArgs {
  propertyId: string;
  guestId: string;
  guestEmail: string;
  checkIn: Date;
  checkOut: Date;
  numAdults: number;
  numChildren: number;
  guestMessage?: string;
}

export type CreateBookingResult =
  | { ok: true; bookingId: string; checkoutUrl: string; requiresApproval: false }
  | { ok: true; bookingId: string; checkoutUrl: null; requiresApproval: true }
  | { ok: false; error: string; status: number };

// Held bookings expire after this many minutes if the guest doesn't
// pay. Matches the cron-job sweep in Task 2.10. We pass this to
// Stripe Checkout's `expires_at` so the session itself dies in lockstep.
const PENDING_TTL_MINUTES = 30;

// Creates a pending booking and a Stripe Checkout Session in one
// orchestrated flow. Steps:
//
//   1. Inside withPropertyLock (advisory lock on the property id):
//      a. Re-validate availability — protects against double-booking
//         when two requests race.
//      b. Calculate the price.
//      c. Insert Booking (status=pending) + BookingPriceSnapshot rows
//         in a single transaction.
//
//   2. After the lock is released, create the Stripe Checkout Session
//      with the booking id in metadata. The webhook handler in 2.7
//      uses that metadata to find and confirm the booking.
//
//   3. If Stripe rejects the session, mark the booking cancelled so
//      the dates are released immediately rather than waiting for the
//      cron sweep.
export async function createBooking(args: CreateBookingArgs): Promise<CreateBookingResult> {
  const {
    propertyId,
    guestId,
    guestEmail,
    checkIn,
    checkOut,
    numAdults,
    numChildren,
    guestMessage,
  } = args;

  // ---- Step 1: lock + create pending booking ----
  let bookingId: string;
  let currency: string;
  let lineItems: { name: string; description?: string; amountPence: number }[];

  try {
    const result = await withPropertyLock(propertyId, async (tx) => {
      const availability = await checkAvailability({ propertyId, checkIn, checkOut }, tx);
      if (!availability.available) {
        throw new BookingError(409, availability.message);
      }

      const priceResult = await calculatePrice({
        propertyId,
        checkIn,
        checkOut,
        numAdults,
        numChildren,
      });
      if (!priceResult.ok) {
        throw new BookingError(400, priceResult.message);
      }
      const breakdown = priceResult.breakdown;

      // Snapshot the property's cancellation policy at booking time so
      // later changes don't retroactively alter terms.
      const property = await tx.property.findUniqueOrThrow({
        where: { id: propertyId },
        select: {
          cancellationPolicy: true,
          cancellationTiers: true,
          checkInTime: true,
          checkOutTime: true,
          name: true,
          instantBookingEnabled: true,
        },
      });

      const booking = await tx.booking.create({
        data: {
          propertyId,
          guestId,
          checkIn,
          checkOut,
          numGuestsAdults: numAdults,
          numGuestsChildren: numChildren,
          status: "pending",
          bookingType: property.instantBookingEnabled ? "instant" : "request",
          totalPrice: new Decimal(breakdown.total),
          currency: breakdown.currency,
          cancellationPolicySnapshot: {
            policy: property.cancellationPolicy,
            tiers: property.cancellationTiers as Prisma.JsonArray,
            checkInTime: property.checkInTime,
            checkOutTime: property.checkOutTime,
            capturedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
          guestMessage,
          priceSnapshot: {
            create: {
              nightlyRates: breakdown.nightlyRates as unknown as Prisma.InputJsonValue,
              numNights: breakdown.numNights,
              subtotalAccommodation: new Decimal(breakdown.subtotalAccommodation),
              cleaningFee: new Decimal(breakdown.cleaningFee),
              extraGuestFeeTotal: new Decimal(breakdown.extraGuestFeeTotal),
              discountAmount: new Decimal(breakdown.discountAmount),
              discountDescription: breakdown.discountDescription,
              serviceFee: new Decimal(breakdown.serviceFee),
              taxAmount: new Decimal(breakdown.taxAmount),
              taxDescription: breakdown.taxDescription,
              total: new Decimal(breakdown.total),
              currency: breakdown.currency,
            },
          },
        },
      });

      // Build Stripe line items in pence/cents. We use multiple lines
      // (instead of one combined "Booking" line) so the guest sees the
      // exact breakdown on the Stripe checkout page.
      const items: { name: string; description?: string; amountPence: number }[] = [
        {
          name: property.name,
          description: `${breakdown.numNights} ${breakdown.numNights === 1 ? "night" : "nights"}`,
          amountPence: toPence(breakdown.subtotalAccommodation),
        },
      ];
      if (Number(breakdown.cleaningFee) > 0) {
        items.push({ name: "Cleaning fee", amountPence: toPence(breakdown.cleaningFee) });
      }
      if (Number(breakdown.extraGuestFeeTotal) > 0) {
        items.push({ name: "Extra guests", amountPence: toPence(breakdown.extraGuestFeeTotal) });
      }

      return {
        bookingId: booking.id,
        currency: breakdown.currency,
        items,
        instantBookingEnabled: property.instantBookingEnabled,
      };
    });

    bookingId = result.bookingId;
    currency = result.currency;
    lineItems = result.items;

    // Request-to-book property: booking is created in "request"
    // state and waits for host approval. No Stripe session yet —
    // that's created when the host approves.
    if (!result.instantBookingEnabled) {
      return { ok: true, bookingId, checkoutUrl: null, requiresApproval: true };
    }
  } catch (e) {
    if (e instanceof BookingError) {
      return { ok: false, error: e.message, status: e.status };
    }
    throw e;
  }

  // ---- Step 2: create the Stripe Checkout Session ----
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: guestEmail,
      line_items: lineItems.map((item) => ({
        quantity: 1,
        price_data: {
          currency: currency.toLowerCase(),
          unit_amount: item.amountPence,
          product_data: {
            name: item.name,
            ...(item.description ? { description: item.description } : {}),
          },
        },
      })),
      // The webhook keys off this metadata to find and confirm the
      // booking. Also stash it on the PaymentIntent so it shows up on
      // every payment-side event too.
      metadata: { booking_id: bookingId },
      payment_intent_data: {
        metadata: { booking_id: bookingId },
      },
      success_url: `${siteUrl()}/booking/success?booking_id=${bookingId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/booking/cancel?booking_id=${bookingId}`,
      expires_at: Math.floor(Date.now() / 1000) + PENDING_TTL_MINUTES * 60,
    });

    if (!session.url) {
      // Shouldn't happen — Stripe always returns a URL on success —
      // but treat it as a failure to be safe.
      await markBookingCancelled(bookingId, "stripe_session_no_url");
      return { ok: false, error: "Could not create payment session.", status: 500 };
    }

    return { ok: true, bookingId, checkoutUrl: session.url, requiresApproval: false };
  } catch (e) {
    // Roll back the pending booking so the dates are released
    // immediately rather than waiting for the cron sweep.
    await markBookingCancelled(bookingId, "stripe_session_failed");
    const message = e instanceof Error ? e.message : "Could not create payment session.";
    return { ok: false, error: message, status: 502 };
  }
}

class BookingError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function markBookingCancelled(bookingId: string, reason: string): Promise<void> {
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
      cancellationReason: reason,
    },
  });
}

function toPence(value: string): number {
  // Multiply the decimal-string by 100 via Prisma.Decimal so we never
  // touch floats. Result is rounded to the nearest integer pence.
  return new Decimal(value).mul(100).toDecimalPlaces(0).toNumber();
}
