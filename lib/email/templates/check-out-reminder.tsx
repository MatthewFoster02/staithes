import {
  Card,
  CardRow,
  EmailLayout,
  Paragraph,
  formatDateLong,
} from "./layout";
import type { BookingEmailContext } from "./context";

export function CheckOutReminderEmail(ctx: BookingEmailContext) {
  return (
    <EmailLayout
      preview={`Check-out tomorrow at ${ctx.propertyName}`}
      heading="Check-out tomorrow"
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
        Just a heads-up that check-out is tomorrow,{" "}
        <strong>{formatDateLong(ctx.checkOutISO)}</strong>, by{" "}
        <strong>{ctx.checkOutTime}</strong>.
      </Paragraph>
      <Card>
        <CardRow label="Before you leave" value="Pop the bins out, leave keys on the kitchen counter" />
        <CardRow label="Check-out time" value={ctx.checkOutTime} />
      </Card>
      <Paragraph>
        Hope you&rsquo;ve had a great stay. We&rsquo;ll send a thank-you note
        tomorrow with a quick way to leave a review if you&rsquo;ve got a
        moment.
      </Paragraph>
    </EmailLayout>
  );
}
