import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export interface BookingConfirmationEmailProps {
  guestFirstName: string;
  propertyName: string;
  checkInISO: string; // YYYY-MM-DD
  checkOutISO: string; // YYYY-MM-DD
  numNights: number;
  totalPrice: string; // already formatted as fixed-2 decimal string
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
  const symbol = currencySymbol(currency);

  return (
    <Html>
      <Head />
      <Preview>
        Your booking at {propertyName} is confirmed for {checkIn} → {checkOut}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Your booking is confirmed</Heading>

          <Text style={paragraph}>Hi {guestFirstName},</Text>

          <Text style={paragraph}>
            Thank you for booking <strong>{propertyName}</strong>. We&rsquo;re
            looking forward to having you. Here are the details:
          </Text>

          <Section style={card}>
            <Row label="Check-in" value={checkIn} />
            <Row label="Check-out" value={checkOut} />
            <Row label="Nights" value={String(numNights)} />
            <Hr style={hr} />
            <Row
              label="Total paid"
              value={`${symbol}${totalPrice}`}
              emphasis
            />
          </Section>

          <Text style={paragraph}>
            We&rsquo;ll send a follow-up message with check-in instructions and
            the exact address closer to your arrival date. In the meantime, if
            you have any questions just reply to this email.
          </Text>

          <Hr style={hr} />

          <Text style={footer}>
            Booking reference: {bookingReference}
            <br />
            Sent by Staithes — {propertyName}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

function Row({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <Text style={emphasis ? rowEmphasis : row}>
      <span style={{ color: "#737373" }}>{label}: </span>
      <strong>{value}</strong>
    </Text>
  );
}

function formatDateLong(iso: string): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function currencySymbol(currency: string): string {
  const symbols: Record<string, string> = { GBP: "£", EUR: "€", USD: "$" };
  return symbols[currency] ?? `${currency} `;
}

// ---- Styles ----

const body: React.CSSProperties = {
  backgroundColor: "#f5f5f5",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  margin: 0,
  padding: 0,
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  margin: "40px auto",
  padding: "32px",
  maxWidth: "560px",
  borderRadius: "12px",
};

const heading: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 600,
  margin: "0 0 24px",
  color: "#0a0a0a",
};

const paragraph: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: "24px",
  color: "#404040",
  margin: "0 0 16px",
};

const card: React.CSSProperties = {
  backgroundColor: "#fafafa",
  border: "1px solid #e5e5e5",
  borderRadius: "8px",
  padding: "16px 20px",
  margin: "20px 0",
};

const row: React.CSSProperties = {
  fontSize: "14px",
  color: "#262626",
  margin: "6px 0",
};

const rowEmphasis: React.CSSProperties = {
  fontSize: "16px",
  color: "#0a0a0a",
  margin: "6px 0",
  fontWeight: 600,
};

const hr: React.CSSProperties = {
  borderColor: "#e5e5e5",
  margin: "20px 0",
};

const footer: React.CSSProperties = {
  fontSize: "12px",
  color: "#737373",
  marginTop: "24px",
  textAlign: "center" as const,
};
