import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { prisma } from "@/lib/db/prisma";
import { confirmBooking, cancelPendingBooking } from "@/lib/booking/confirm";

// Webhooks must verify against the raw request body — Next.js's JSON
// parser would mutate it. We force-dynamic to bypass any caching and
// pull the body as text.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "webhook misconfigured" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing stripe-signature header" }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    console.error(`[stripe webhook] signature verification failed: ${message}`);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  // Idempotency: try to insert the event id. If it already exists,
  // this is a retry and we ack with 200 without re-processing. Stripe
  // expects any 2xx as success and stops retrying.
  try {
    await prisma.webhookEvent.create({
      data: { id: event.id, source: "stripe", type: event.type },
    });
  } catch {
    // Most likely a unique-constraint violation (already processed).
    // Returning 200 without re-running side effects is the safe move.
    console.log(`[stripe webhook] duplicate ${event.type} ${event.id} — skipping`);
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await dispatch(event);
  } catch (err) {
    // Roll back the webhookEvent row so the next retry from Stripe
    // gets a chance to re-run. We return 500 so Stripe knows to retry.
    await prisma.webhookEvent.delete({ where: { id: event.id } }).catch(() => {});
    console.error(`[stripe webhook] handler failed for ${event.type} ${event.id}:`, err);
    return NextResponse.json({ error: "handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function dispatch(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      return;
    case "checkout.session.expired":
      await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session);
      return;
    default:
      // Phase 8 will add charge.refunded handling for the cancellation
      // flow. Other events are intentionally ignored — Stripe sends
      // many we don't care about.
      console.log(`[stripe webhook] ignoring ${event.type}`);
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const bookingId = session.metadata?.booking_id;
  if (!bookingId) {
    throw new Error(`checkout.session.completed missing booking_id metadata (session ${session.id})`);
  }
  if (session.payment_status !== "paid") {
    // The session can complete without payment in some flows
    // (e.g., setup mode). For our payment-mode checkouts this should
    // never fire, but guard anyway.
    console.log(`[stripe webhook] checkout ${session.id} completed but not paid — ignoring`);
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (!paymentIntentId) {
    throw new Error(`checkout.session.completed missing payment_intent (session ${session.id})`);
  }

  // Fetch the payment intent expanded so we can lift card brand /
  // last4 onto the Payment row. Cheap — single API call.
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge.payment_method_details.card"],
  });
  const charge = intent.latest_charge as Stripe.Charge | null;
  const card = charge?.payment_method_details?.card ?? null;

  const result = await confirmBooking({
    bookingId,
    paymentIntentId,
    amountTotalPence: session.amount_total ?? 0,
    currency: session.currency ?? "gbp",
    cardBrand: card?.brand ?? null,
    cardLastFour: card?.last4 ?? null,
  });

  if (!result.ok) {
    throw new Error(result.error);
  }
}

async function handleCheckoutExpired(session: Stripe.Checkout.Session): Promise<void> {
  const bookingId = session.metadata?.booking_id;
  if (!bookingId) {
    console.warn(`[stripe webhook] checkout.session.expired missing booking_id (session ${session.id})`);
    return;
  }
  await cancelPendingBooking({ bookingId, reason: "stripe_session_expired" });
}
