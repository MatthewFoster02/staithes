import {
  Card,
  CardRow,
  EmailLayout,
  Paragraph,
  formatDateLong,
} from "./layout";
import type { BookingEmailContext } from "./context";

export function PreArrivalEmail(ctx: BookingEmailContext) {
  return (
    <EmailLayout
      preview={`Your stay at ${ctx.propertyName} is almost here`}
      heading="Your stay is almost here"
      footer={
        <>
          Booking reference: {ctx.bookingReference}
          <br />
          Sent by Staithes — {ctx.propertyName}
        </>
      }
    >
      <Paragraph>Hi {ctx.guestFirstName},</Paragraph>
      <Paragraph>
        Quick note ahead of your arrival at <strong>{ctx.propertyName}</strong>{" "}
        on <strong>{formatDateLong(ctx.checkInISO)}</strong>. Here&rsquo;s
        everything you need to know:
      </Paragraph>
      <Card>
        <CardRow label="Check-in" value={`${formatDateLong(ctx.checkInISO)}, from ${ctx.checkInTime}`} />
        <CardRow label="Check-out" value={`${formatDateLong(ctx.checkOutISO)}, by ${ctx.checkOutTime}`} />
        <CardRow label="Address" value={ctx.addressFull} />
      </Card>
      <Paragraph>
        We&rsquo;ll send the keypad code and final check-in instructions on the
        morning of your arrival. If your plans change or you have any
        questions in the meantime, just reply to this email.
      </Paragraph>
      <Paragraph>Looking forward to having you.</Paragraph>
    </EmailLayout>
  );
}
