import { prisma } from "@/lib/db/prisma";

// Pending bookings older than this are swept by the cron route. Must
// match (or exceed) the PENDING_TTL_MINUTES used by lib/booking/create.ts
// — the Stripe checkout session itself expires at the same window, so
// the webhook usually beats the cron to it. The cron is the safety
// net for cases where the webhook never fires (e.g. user closes the
// tab and Stripe takes its time emitting checkout.session.expired).
export const PENDING_TTL_MINUTES = 30;

// Sweeps and cancels all stale pending bookings. Returns a count for
// observability. Idempotent — re-running it is a no-op.
export async function expireStalePendingBookings(): Promise<{ cancelled: number }> {
  const cutoff = new Date(Date.now() - PENDING_TTL_MINUTES * 60 * 1000);
  const result = await prisma.booking.updateMany({
    where: {
      status: "pending",
      createdAt: { lt: cutoff },
    },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
      cancellationReason: "payment_window_expired",
    },
  });
  return { cancelled: result.count };
}
