import {
  Card,
  CardRow,
  EmailLayout,
  Paragraph,
  currencySymbol,
  formatDateLong,
} from "./layout";

export interface BookingConfirmationEmailProps {
  guestFirstName: string;
  propertyName: string;
  checkInISO: string;
  checkOutISO: string;
  numNights: number;
  totalPrice: string;
  currency: string;
  bookingReference: string;
}

export function BookingConfirmationEmail({
  guestFirstName,
  propertyName,
  checkInISO,
  checkOutISO,
  numNights,
  totalPrice,
  currency,
  bookingReference,
}: BookingConfirmationEmailProps) {
  const checkIn = formatDateLong(checkInISO);
  const checkOut = formatDateLong(checkOutISO);
  return (
    <EmailLayout
      preview={`Your booking at ${propertyName} is confirmed for ${checkIn} → ${checkOut}`}
      heading="Your booking is confirmed"
      footer={
        <>
          Booking reference: {bookingReference}
          <br />
          Sent by Staithes — {propertyName}
        </>
      }
    >
      <Paragraph>Hi {guestFirstName},</Paragraph>
      <Paragraph>
        Thank you for booking <strong>{propertyName}</strong>. We&rsquo;re looking
        forward to having you. Here are the details:
      </Paragraph>
      <Card>
        <CardRow label="Check-in" value={checkIn} />
        <CardRow label="Check-out" value={checkOut} />
        <CardRow label="Nights" value={String(numNights)} />
        <CardRow
          label="Total paid"
          value={`${currencySymbol(currency)}${totalPrice}`}
          emphasis
        />
      </Card>
      <Paragraph>
        We&rsquo;ll send a follow-up message with check-in instructions and the
        exact address closer to your arrival date. In the meantime, if you have
        any questions just reply to this email.
      </Paragraph>
    </EmailLayout>
  );
}
