import { Resend } from "resend";

// Lazy server-side Resend singleton. Same Proxy pattern as the
// Stripe and Prisma clients so CLI scripts and tests don't crash on
// missing env at module-load time.

let cached: Resend | null = null;

function createResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

export const resend = new Proxy({} as Resend, {
  get(_target, prop, receiver) {
    if (!cached) cached = createResend();
    return Reflect.get(cached, prop, receiver);
  },
}) as Resend;

export function senderEmail(): string {
  // RESEND_FROM_EMAIL is required at runtime so misconfiguration is
  // caught at the call site, not silently swallowed.
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) throw new Error("RESEND_FROM_EMAIL is not set");
  return from;
}
