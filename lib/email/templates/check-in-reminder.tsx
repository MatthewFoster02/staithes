import {
  Card,
  CardRow,
  EmailLayout,
  Paragraph,
} from "./layout";
import type { BookingEmailContext } from "./context";

export function CheckInReminderEmail(ctx: BookingEmailContext) {
  return (
    <EmailLayout
      preview={`Welcome to ${ctx.propertyName} — see you today`}
      heading="Today's the day"
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
        Welcome to your stay at <strong>{ctx.propertyName}</strong>. Check-in is
        from <strong>{ctx.checkInTime}</strong> today. Here&rsquo;s what you
        need:
      </Paragraph>
      <Card>
        <CardRow label="Address" value={ctx.addressFull} />
        <CardRow label="Check-in from" value={ctx.checkInTime} />
        <CardRow label="Check-out by" value={`${ctx.checkOutTime} on the last day`} />
      </Card>
      <Paragraph>
        We&rsquo;ll send the keypad code in a separate message shortly. Drive
        safely and reply to this email if you hit any snags on the way in.
      </Paragraph>
    </EmailLayout>
  );
}
