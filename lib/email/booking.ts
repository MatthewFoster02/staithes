// Stub. The real implementation lands in Task 2.8 (Resend + React
// Email templates). The webhook handler in 2.7 calls this so the
// integration point exists from day one — flipping it to a real
// send is a one-file change.

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

export async function sendBookingConfirmationEmail(
  args: SendBookingConfirmationArgs,
): Promise<void> {
  console.log(
    `[email stub] Booking confirmation for ${args.guestEmail} — ${args.propertyName}, ${args.checkIn.toISOString().slice(0, 10)} → ${args.checkOut.toISOString().slice(0, 10)}, ${args.currency} ${args.totalPrice} (booking ${args.bookingId})`,
  );
}
