import {
  Button,
  Section,
} from "@react-email/components";
import { EmailLayout, Paragraph } from "./layout";
import type { BookingEmailContext } from "./context";

export function PostStayThanksEmail(ctx: BookingEmailContext) {
  return (
    <EmailLayout
      preview={`Thanks for staying with us at ${ctx.propertyName}`}
      heading="Thanks for staying with us"
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
        Thanks for staying at <strong>{ctx.propertyName}</strong> — we hope you
        had a great time and a safe journey home.
      </Paragraph>
      <Paragraph>
        If you have a couple of minutes, we&rsquo;d really appreciate a short
        review. It helps future guests decide whether the property is right for
        them, and tells us what we could do better.
      </Paragraph>
      {ctx.reviewUrl && (
        <Section style={{ textAlign: "center", margin: "24px 0" }}>
          <Button
            href={ctx.reviewUrl}
            style={{
              backgroundColor: "#0a0a0a",
              color: "#ffffff",
              padding: "12px 24px",
              borderRadius: "8px",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            Leave a review
          </Button>
        </Section>
      )}
      <Paragraph>
        And if you&rsquo;d like to come back, we&rsquo;ll be here. Just reply
        to this email any time.
      </Paragraph>
    </EmailLayout>
  );
}
