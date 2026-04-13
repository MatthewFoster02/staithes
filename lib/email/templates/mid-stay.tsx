import { EmailLayout, Paragraph } from "./layout";
import type { BookingEmailContext } from "./context";

export function MidStayEmail(ctx: BookingEmailContext) {
  return (
    <EmailLayout
      preview={`How's your stay at ${ctx.propertyName}?`}
      heading="How's your stay going?"
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
        Just a quick check-in to see how your stay at{" "}
        <strong>{ctx.propertyName}</strong> is going.
      </Paragraph>
      <Paragraph>
        If you need anything — extra towels, a recommendation for dinner,
        anything that&rsquo;s not quite right — just reply to this email and
        we&rsquo;ll sort it out.
      </Paragraph>
      <Paragraph>Hope you&rsquo;re settling in nicely.</Paragraph>
    </EmailLayout>
  );
}
