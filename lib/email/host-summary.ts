import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { resend, senderEmail } from "@/lib/email/client";
import { addDays, formatISODate, todayUTC } from "@/lib/availability/dates";
import { getHostEmails } from "@/lib/auth/host";
import {
  HostDailySummaryEmail,
  type HostSummaryBookingRow,
} from "@/lib/email/templates/host-daily-summary";

export type DailyHostSummaryResult =
  | { sent: false; reason: "nothing_to_report" | "already_sent" | "no_recipients" | "no_property" }
  | { sent: true; recipients: number; arrivals: number; departures: number; newBookings: number };

interface SendOptions {
  /** Skip the actual Resend send and don't write a log row. */
  dryRun?: boolean;
  /** Override "today" — only used by the smoke test. */
  forDate?: Date;
}

// Sends a single host-summary email to every address on HOST_EMAILS,
// idempotent per UTC day via HostDailySummaryLog.date. Skips entirely
// when there's nothing to report (the user explicitly opted in to
// quiet days during Phase 5.3 design).
export async function sendDailyHostSummary(
  options: SendOptions = {},
): Promise<DailyHostSummaryResult> {
  const today = options.forDate ?? todayUTC();
  const tomorrow = addDays(today, 1);
  const yesterdayStart = addDays(today, -1);

  const property = await prisma.property.findFirst({
    select: { id: true, name: true },
  });
  if (!property) {
    return { sent: false, reason: "no_property" };
  }

  const hostEmails = getHostEmails();
  if (hostEmails.length === 0) {
    return { sent: false, reason: "no_recipients" };
  }

  // Three queries in parallel: today's arrivals, today's check-outs,
  // and bookings created since yesterday morning. We only count
  // confirmed bookings — pending ones are noise that gets cleaned up
  // by the expire-bookings cron.
  const [arrivals, departures, newBookings] = await Promise.all([
    prisma.booking.findMany({
      where: {
        propertyId: property.id,
        status: "confirmed",
        checkIn: { gte: today, lt: tomorrow },
      },
      include: { guest: { select: { firstName: true, lastName: true } } },
      orderBy: { checkIn: "asc" },
    }),
    prisma.booking.findMany({
      where: {
        propertyId: property.id,
        status: "confirmed",
        checkOut: { gte: today, lt: tomorrow },
      },
      include: { guest: { select: { firstName: true, lastName: true } } },
      orderBy: { checkOut: "asc" },
    }),
    prisma.booking.findMany({
      where: {
        propertyId: property.id,
        status: "confirmed",
        createdAt: { gte: yesterdayStart },
      },
      include: { guest: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Quiet-day skip — option (b) from the build plan.
  if (arrivals.length === 0 && departures.length === 0 && newBookings.length === 0) {
    return { sent: false, reason: "nothing_to_report" };
  }

  // Idempotency: try to claim today's date by inserting a log row.
  // A unique violation means another invocation already sent today.
  if (!options.dryRun) {
    try {
      await prisma.hostDailySummaryLog.create({
        data: { date: today },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return { sent: false, reason: "already_sent" };
      }
      throw err;
    }
  }

  const arrivalRows = arrivals.map(toRow);
  const departureRows = departures.map(toRow);
  const newRows = newBookings.map(toRow);
  const dateISO = formatISODate(today);

  if (options.dryRun) {
    console.log(
      `[host-summary dry-run] would send to ${hostEmails.length} recipient(s): ` +
        `arrivals=${arrivals.length} departures=${departures.length} new=${newBookings.length}`,
    );
    return {
      sent: true,
      recipients: hostEmails.length,
      arrivals: arrivals.length,
      departures: departures.length,
      newBookings: newBookings.length,
    };
  }

  // Send to all hosts. Failures are logged but we don't roll back
  // the claim row — we'd rather under-deliver than re-send tomorrow.
  for (const recipient of hostEmails) {
    try {
      const { error } = await resend.emails.send({
        from: senderEmail(),
        to: recipient,
        subject: `Daily summary — ${property.name}`,
        react: HostDailySummaryEmail({
          dateISO,
          propertyName: property.name,
          arrivals: arrivalRows,
          departures: departureRows,
          newBookings: newRows,
        }),
      });
      if (error) {
        console.error(`[host-summary] Resend error for ${recipient}:`, error);
      }
    } catch (err) {
      console.error(`[host-summary] failed to send to ${recipient}:`, err);
    }
  }

  return {
    sent: true,
    recipients: hostEmails.length,
    arrivals: arrivals.length,
    departures: departures.length,
    newBookings: newBookings.length,
  };
}

function toRow(booking: {
  id: string;
  checkIn: Date;
  checkOut: Date;
  totalPrice: Prisma.Decimal;
  currency: string;
  guest: { firstName: string; lastName: string };
}): HostSummaryBookingRow {
  const numNights = Math.round(
    (booking.checkOut.getTime() - booking.checkIn.getTime()) / 86_400_000,
  );
  return {
    bookingId: booking.id,
    guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
    checkInISO: formatISODate(booking.checkIn),
    checkOutISO: formatISODate(booking.checkOut),
    numNights,
    totalPrice: booking.totalPrice.toFixed(2),
    currency: booking.currency,
  };
}
