import type { ReactElement } from "react";
import { Prisma } from "@/lib/generated/prisma/client";
import type { AutomatedEmailType } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { resend, senderEmail } from "@/lib/email/client";
import { addDays, formatISODate, todayUTC } from "@/lib/availability/dates";
import { siteUrl } from "@/lib/seo/site";
import { PreArrivalEmail } from "@/lib/email/templates/pre-arrival";
import { CheckInReminderEmail } from "@/lib/email/templates/check-in-reminder";
import { MidStayEmail } from "@/lib/email/templates/mid-stay";
import { CheckOutReminderEmail } from "@/lib/email/templates/check-out-reminder";
import { PostStayThanksEmail } from "@/lib/email/templates/post-stay-thanks";
import type { BookingEmailContext } from "@/lib/email/templates/context";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ProcessOptions {
  /** Skip the actual Resend send and don't write a log row. Used by smoke tests. */
  dryRun?: boolean;
}

export interface ProcessResult {
  /** Map of email type → number of sends. */
  sent: Record<string, number>;
  errors: number;
}

// ---------------------------------------------------------------------------
// Schedule rules
// ---------------------------------------------------------------------------

// Each automated email type has a "due" predicate (a Prisma where
// clause) and a subject + render function. Date windows are
// deliberately generous (multi-day) so a missed cron tick doesn't
// drop a send — the unique constraint on (booking_id, email_type)
// stops re-sends. Rendering the templates uses the shared
// BookingEmailContext, built in `buildContext` below from the
// booking + property + guest rows.

interface EmailRule {
  type: AutomatedEmailType;
  /** Subject line — gets the property name interpolated. */
  subjectFor: (ctx: BookingEmailContext) => string;
  /** Render the template. */
  render: (ctx: BookingEmailContext) => ReactElement;
  /**
   * Returns the Prisma where clause that selects bookings due for
   * this email type *today*. The window is wider than a single day
   * so a missed cron tick doesn't drop the send.
   */
  whereDue: (today: Date) => Prisma.BookingWhereInput;
}

const RULES: EmailRule[] = [
  {
    type: "pre_arrival",
    subjectFor: (ctx) => `Your stay at ${ctx.propertyName} is almost here`,
    render: (ctx) => PreArrivalEmail(ctx),
    // Window: check-in is 1–3 days away.
    whereDue: (today) => ({
      checkIn: { gte: addDays(today, 1), lte: addDays(today, 3) },
    }),
  },
  {
    type: "check_in_reminder",
    subjectFor: (ctx) => `Welcome to ${ctx.propertyName} — see you today`,
    render: (ctx) => CheckInReminderEmail(ctx),
    // Window: check-in is today.
    whereDue: (today) => ({
      checkIn: { gte: today, lt: addDays(today, 1) },
    }),
  },
  {
    type: "mid_stay",
    subjectFor: (ctx) => `How's your stay at ${ctx.propertyName}?`,
    render: (ctx) => MidStayEmail(ctx),
    // Window: today is at least 2 days into the stay (i.e., 3rd day
    // or later) AND there are still nights left, AND the booking is
    // 5+ nights long. The night-count check is done in JS after the
    // SQL filter because Prisma can't compute differences inside the
    // where clause.
    whereDue: (today) => ({
      checkIn: { lte: addDays(today, -2) },
      checkOut: { gt: today },
    }),
  },
  {
    type: "check_out_reminder",
    subjectFor: (ctx) => `Check-out tomorrow at ${ctx.propertyName}`,
    render: (ctx) => CheckOutReminderEmail(ctx),
    // Window: check-out is exactly tomorrow.
    whereDue: (today) => ({
      checkOut: { gte: addDays(today, 1), lt: addDays(today, 2) },
    }),
  },
  {
    type: "post_stay_thanks",
    subjectFor: () => "Thanks for staying with us",
    render: (ctx) => PostStayThanksEmail(ctx),
    // Window: check-out was within the last 7 days. Generous window
    // gives a missed cron a chance to recover; the unique log row
    // stops dupes.
    whereDue: (today) => ({
      checkOut: { gte: addDays(today, -7), lt: addDays(today, 1) },
    }),
  },
];

// ---------------------------------------------------------------------------
// processBookingEmails
// ---------------------------------------------------------------------------

export async function processBookingEmails(
  options: ProcessOptions = {},
): Promise<ProcessResult> {
  const today = todayUTC();
  const sent: Record<string, number> = {};
  let errors = 0;

  for (const rule of RULES) {
    const candidates = await prisma.booking.findMany({
      where: {
        status: "confirmed",
        ...rule.whereDue(today),
        // Skip bookings that already have a log row for this type.
        automatedEmails: { none: { emailType: rule.type } },
      },
      include: {
        guest: { select: { firstName: true, email: true } },
        property: true,
      },
    });

    for (const booking of candidates) {
      // mid_stay has an extra "stay length >= 5 nights" gate that
      // can't go in the SQL where clause cleanly.
      if (rule.type === "mid_stay") {
        const numNights = Math.round(
          (booking.checkOut.getTime() - booking.checkIn.getTime()) / 86_400_000,
        );
        if (numNights < 5) continue;
      }

      const ctx = buildContext(booking);
      const subject = rule.subjectFor(ctx);
      const react = rule.render(ctx);

      try {
        await sendAndLog({
          bookingId: booking.id,
          guestEmail: booking.guest.email,
          type: rule.type,
          subject,
          react,
          dryRun: options.dryRun ?? false,
        });
        sent[rule.type] = (sent[rule.type] ?? 0) + 1;
      } catch (err) {
        console.error(
          `[scheduler] failed to send ${rule.type} for booking ${booking.id}:`,
          err,
        );
        errors++;
      }
    }
  }

  return { sent, errors };
}

// ---------------------------------------------------------------------------
// sendAndLog
// ---------------------------------------------------------------------------

async function sendAndLog(args: {
  bookingId: string;
  guestEmail: string;
  type: AutomatedEmailType;
  subject: string;
  react: ReactElement;
  dryRun: boolean;
}): Promise<void> {
  // Claim-first idempotency: insert the log row before sending. If a
  // unique violation comes back another worker is already on it.
  try {
    await prisma.automatedEmailLog.create({
      data: {
        bookingId: args.bookingId,
        emailType: args.type,
        recipientEmail: args.guestEmail,
        subject: args.subject,
        status: "sent",
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      // Already claimed elsewhere — silent skip.
      return;
    }
    throw err;
  }

  if (args.dryRun) {
    console.log(`[scheduler dry-run] ${args.type} → ${args.guestEmail}`);
    return;
  }

  try {
    const { error } = await resend.emails.send({
      from: senderEmail(),
      to: args.guestEmail,
      subject: args.subject,
      react: args.react,
    });
    if (error) throw error;
  } catch (err) {
    // Roll back the claim so the next cron tick gets to retry.
    await prisma.automatedEmailLog
      .delete({
        where: {
          bookingId_emailType: {
            bookingId: args.bookingId,
            emailType: args.type,
          },
        },
      })
      .catch(() => {});
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

interface BookingForEmail {
  id: string;
  checkIn: Date;
  checkOut: Date;
  guest: { firstName: string; email: string };
  property: {
    name: string;
    addressApprox: string;
    addressFull: string;
    checkInTime: string;
    checkOutTime: string;
  };
}

function buildContext(booking: BookingForEmail): BookingEmailContext {
  const numNights = Math.round(
    (booking.checkOut.getTime() - booking.checkIn.getTime()) / 86_400_000,
  );
  return {
    guestFirstName: booking.guest.firstName,
    propertyName: booking.property.name,
    addressApprox: booking.property.addressApprox,
    addressFull: booking.property.addressFull,
    checkInISO: formatISODate(booking.checkIn),
    checkOutISO: formatISODate(booking.checkOut),
    checkInTime: booking.property.checkInTime,
    checkOutTime: booking.property.checkOutTime,
    numNights,
    bookingReference: booking.id.slice(0, 8).toUpperCase(),
    reviewUrl: `${siteUrl()}/dashboard/bookings/${booking.id}`,
  };
}
