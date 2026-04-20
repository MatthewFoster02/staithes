import { Button, Section } from "@react-email/components";
import {
  Card,
  CardRow,
  EmailLayout,
  Paragraph,
  currencySymbol,
  formatDateLong,
} from "./layout";

export interface RequestApprovedEmailProps {
  guestFirstName: string;
  propertyName: string;
  checkInISO: string;
  checkOutISO: string;
  totalPrice: string;
  currency: string;
  paymentUrl: string;
  bookingReference: string;
}

export function RequestApprovedEmail({
  guestFirstName,
  propertyName,
  checkInISO,
  checkOutISO,
  totalPrice,
  currency,
  paymentUrl,
  bookingReference,
}: RequestApprovedEmailProps) {
  return (
    <EmailLayout
      preview={`Your request to stay at ${propertyName} is approved`}
      heading="Your request is approved"
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
        Good news — the host has approved your request to stay at{" "}
        <strong>{propertyName}</strong>. Confirm your booking by completing
        payment at the link below. The payment link is good for 24 hours.
      </Paragraph>
      <Card>
        <CardRow label="Check-in" value={formatDateLong(checkInISO)} />
        <CardRow label="Check-out" value={formatDateLong(checkOutISO)} />
        <CardRow
          label="Total"
          value={`${currencySymbol(currency)}${totalPrice}`}
          emphasis
        />
      </Card>
      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <Button
          href={paymentUrl}
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
          Complete payment
        </Button>
      </Section>
      <Paragraph>
        If the button doesn&rsquo;t work, open this link in your browser:
        <br />
        <a href={paymentUrl} style={{ color: "#0a0a0a" }}>
          {paymentUrl}
        </a>
      </Paragraph>
    </EmailLayout>
  );
}
