import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/client";
import { confirmBooking } from "@/lib/booking/confirm";
import { TrackEvent } from "@/components/analytics/plausible";
import type Stripe from "stripe";

export const metadata: Metadata = {
  title: "Booking confirmed",
};

interface PageProps {
  searchParams: Promise<{ booking_id?: string; session_id?: string }>;
}

// Safety net for when the Stripe webhook is late or missing (e.g.
// local dev without `stripe listen`, or a webhook delivery failure).
// We verify the Stripe session server-side — NOT just trusting the
// URL params, which a malicious user could hand-craft. If the
// checkout session is genuinely paid and the booking row is still
// pending, we confirm it here. Otherwise it's a no-op and the
// eventual webhook will converge the DB.
async function tryConfirmFallback(bookingId: string, sessionId: string): Promise<void> {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, status: true },
    });
    if (!booking || booking.status !== "pending") return;

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent.latest_charge.payment_method_details.card"],
    });
    if (session.metadata?.booking_id !== bookingId) return;
    if (session.payment_status !== "paid") return;

    const intent =
      typeof session.payment_intent === "string"
        ? null
        : (session.payment_intent as Stripe.PaymentIntent | null);
    const paymentIntentId = intent?.id;
    if (!paymentIntentId) return;

    const charge = (intent?.latest_charge ?? null) as Stripe.Charge | null;
    const card = charge?.payment_method_details?.card ?? null;

    await confirmBooking({
      bookingId,
      paymentIntentId,
      amountTotalPence: session.amount_total ?? 0,
      currency: session.currency ?? "gbp",
      cardBrand: card?.brand ?? null,
      cardLastFour: card?.last4 ?? null,
    });
  } catch (err) {
    // Never surface a fallback error to the user — the webhook
    // remains authoritative and will heal on its retry schedule.
    console.error(`[success] fallback confirm failed for ${bookingId}:`, err);
  }
}

export default async function BookingSuccessPage({ searchParams }: PageProps) {
  const { booking_id, session_id } = await searchParams;
  if (booking_id && session_id) {
    await tryConfirmFallback(booking_id, session_id);
  }
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 py-12 text-center">
      <TrackEvent name="Booking Completed" />
      <CheckCircle2 className="size-12 text-emerald-600" aria-hidden />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Thanks for your booking</h1>
      <p className="mt-3 text-sm text-neutral-600">
        Your payment has been received. We&rsquo;ll send you a confirmation email
        with all the details shortly.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 text-sm font-medium text-neutral-900 underline-offset-4 hover:underline"
      >
        Go to your dashboard
      </Link>
    </section>
  );
}
