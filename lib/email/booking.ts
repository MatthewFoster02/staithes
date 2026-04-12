import { resend, senderEmail } from "@/lib/email/client";
import { BookingConfirmationEmail } from "@/lib/email/templates/booking-confirmation";
import { formatISODate, differenceInDays } from "@/lib/availability/dates";

interface SendBookingConfirmationArgs {
  bookingId: string;
  guestEmail: string;
  guestFirstName: string;
  propertyName: string;
  checkIn: Date;
  checkOut: Date;
  totalPrice: string;
  currency: string;
}

// Sends the booking confirmation email via Resend. Called from the
// Stripe webhook in 2.7 once the booking is moved to confirmed.
//
// We deliberately don't throw on send failure: the booking is already
// confirmed in the DB and we don't want a flaky email provider to
// cause Stripe webhook retries (which would risk double-confirming).
// Failures are logged for the host to spot in the dashboard / logs.
export async function sendBookingConfirmationEmail(
  args: SendBookingConfirmationArgs,
): Promise<void> {
  const numNights = differenceInDays(args.checkOut, args.checkIn);

  try {
    const { error } = await resend.emails.send({
      from: senderEmail(),
      to: args.guestEmail,
      subject: `Your booking at ${args.propertyName} is confirmed`,
      react: BookingConfirmationEmail({
        guestFirstName: args.guestFirstName,
        propertyName: args.propertyName,
        checkInISO: formatISODate(args.checkIn),
        checkOutISO: formatISODate(args.checkOut),
        numNights,
        totalPrice: args.totalPrice,
        currency: args.currency,
        bookingReference: args.bookingId.slice(0, 8).toUpperCase(),
      }),
    });
    if (error) {
      console.error(
        `[email] Resend rejected booking confirmation for ${args.guestEmail}:`,
        error,
      );
      return;
    }
    console.log(`[email] sent booking confirmation to ${args.guestEmail} (${args.bookingId})`);
  } catch (err) {
    console.error(
      `[email] failed to send booking confirmation to ${args.guestEmail}:`,
      err,
    );
  }
}
