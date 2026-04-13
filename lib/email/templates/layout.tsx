import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";

interface EmailLayoutProps {
  preview: string;
  heading: string;
  children: React.ReactNode;
  /** Footer text below the horizontal rule. Booking ref, etc. */
  footer?: React.ReactNode;
}

// Shared chrome for every transactional email — same outer container,
// brand colours, type scale. Per-email differences live in `children`.
// Inline styles are deliberate: HTML email clients ignore <style> tags
// and most CSS. Inline is the safe way.
export function EmailLayout({ preview, heading, children, footer }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={headingStyle}>{heading}</Heading>
          {children}
          {footer && (
            <>
              <Hr style={hr} />
              <Text style={footerStyle}>{footer}</Text>
            </>
          )}
        </Container>
      </Body>
    </Html>
  );
}

// ---- Shared sub-components used by every template ----

export function Paragraph({ children }: { children: React.ReactNode }) {
  return <Text style={paragraph}>{children}</Text>;
}

export function Card({ children }: { children: React.ReactNode }) {
  return <div style={card}>{children}</div>;
}

export function CardRow({
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

// ---- Helpers used by callers to format dates / money consistently ----

export function formatDateLong(iso: string): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function currencySymbol(currency: string): string {
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

const headingStyle: React.CSSProperties = {
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

const footerStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#737373",
  marginTop: "24px",
  textAlign: "center" as const,
};
