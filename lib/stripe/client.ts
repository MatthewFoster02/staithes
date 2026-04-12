import Stripe from "stripe";

// Lazy server-side Stripe client. Only ever import from server code
// (route handlers, server actions, services) — the secret key must
// never reach the browser. Lazy via Proxy for the same reason as
// lib/db/prisma.ts: CLI scripts and tests would otherwise crash on
// missing env at module-load time.

let cached: Stripe | null = null;

function createStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  // Pinning the apiVersion is the Stripe-recommended pattern: it
  // freezes the request/response shape so future Stripe API releases
  // don't break this codebase silently. The default version follows
  // the installed SDK and is what the SDK's TypeScript types target.
  return new Stripe(key);
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    if (!cached) cached = createStripe();
    return Reflect.get(cached, prop, receiver);
  },
}) as Stripe;
