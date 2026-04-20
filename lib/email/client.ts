import { Resend } from "resend";
import { prisma } from "@/lib/db/prisma";

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

function envSender(): string {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) throw new Error("RESEND_FROM_EMAIL is not set");
  return from;
}

// Sync fallback kept for places that must not touch the DB (tests,
// scripts, CLI). Prefer `resolveSenderFrom` in request-path code so
// the host can override the sender identity from /admin/settings.
export function senderEmail(): string {
  return envSender();
}

// Returns the `from` header string for Resend: "Name <email>" if a
// display name is set, otherwise just the email. Resolution order is
// DB config → RESEND_FROM_EMAIL env. Never throws on DB failures —
// we fall back to env so a bad config can't silence all outbound mail.
export async function resolveSenderFrom(): Promise<string> {
  try {
    const config = await prisma.siteConfiguration.findFirst({
      select: { senderEmail: true, senderName: true },
    });
    const email = config?.senderEmail?.trim() || envSender();
    const name = config?.senderName?.trim();
    return name ? `${name} <${email}>` : email;
  } catch (err) {
    console.error("[email] falling back to env sender:", err);
    return envSender();
  }
}
