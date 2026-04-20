import {
  Card,
  CardRow,
  EmailLayout,
  Paragraph,
  currencySymbol,
  formatDateLong,
} from "./layout";

export interface BookingCancelledEmailProps {
  guestFirstName: string;
  propertyName: string;
  checkInISO: string;
  checkOutISO: string;
  canceller: "guest" | "host" | "system";
  refundAmount: string;
  refundReason: string;
  currency: string;
  reason?: string | null;
  bookingReference: string;
}

export function BookingCancelledEmail({
  guestFirstName,
  propertyName,
  checkInISO,
  checkOutISO,
  canceller,
  refundAmount,
  refundReason,
  currency,
  reason,
  bookingReference,
}: BookingCancelledEmailProps) {
  const numRefund = Number(refundAmount);
  const headline =
    canceller === "host"
      ? "Your booking was cancelled by the host"
      : "Your booking is cancelled";
  return (
    <EmailLayout
      preview={`Your booking at ${propertyName} (${checkInISO} → ${checkOutISO}) is cancelled`}
      heading={headline}
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
        Your booking at <strong>{propertyName}</strong> for{" "}
        {formatDateLong(checkInISO)} → {formatDateLong(checkOutISO)} has been
        cancelled.
      </Paragraph>
      {reason && (
        <Paragraph>
          Reason: <em>{reason}</em>
        </Paragraph>
      )}
      <Card>
        <CardRow
          label="Refund"
          value={
            numRefund > 0
              ? `${currencySymbol(currency)}${refundAmount}`
              : "—"
          }
          emphasis
        />
        <CardRow label="Why this amount" value={refundReason} />
      </Card>
      {numRefund > 0 ? (
        <Paragraph>
          The refund will appear on the card you used for the original payment
          within a few business days.
        </Paragraph>
      ) : (
        <Paragraph>
          No refund was issued based on the cancellation policy you agreed to
          at booking time.
        </Paragraph>
      )}
      <Paragraph>
        If this cancellation was a surprise or you have any questions, just
        reply to this email.
      </Paragraph>
    </EmailLayout>
  );
}
