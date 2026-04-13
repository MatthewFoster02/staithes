import {
  EmailLayout,
  Paragraph,
  formatDateLong,
  currencySymbol,
} from "./layout";

export interface HostSummaryBookingRow {
  bookingId: string;
  guestName: string;
  checkInISO: string;
  checkOutISO: string;
  numNights: number;
  totalPrice: string;
  currency: string;
}

export interface HostDailySummaryEmailProps {
  /** ISO date of the day this summary covers (UTC). */
  dateISO: string;
  propertyName: string;
  arrivals: HostSummaryBookingRow[];
  departures: HostSummaryBookingRow[];
  newBookings: HostSummaryBookingRow[];
}

function formatMoney(value: string, currency: string): string {
  return `${currencySymbol(currency)}${Number(value).toFixed(0)}`;
}

function Section({
  title,
  rows,
  emptyHidden,
}: {
  title: string;
  rows: HostSummaryBookingRow[];
  /** When true, the section is omitted entirely if rows is empty. */
  emptyHidden?: boolean;
}) {
  if (rows.length === 0 && emptyHidden) return null;
  return (
    <div style={{ margin: "0 0 24px" }}>
      <p
        style={{
          fontSize: "12px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "#737373",
          margin: "0 0 8px",
        }}
      >
        {title} ({rows.length})
      </p>
      {rows.length === 0 ? (
        <p style={{ fontSize: "14px", color: "#737373", margin: 0 }}>
          Nothing today.
        </p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {rows.map((row) => (
            <li
              key={row.bookingId}
              style={{
                borderBottom: "1px solid #e5e5e5",
                padding: "8px 0",
                fontSize: "14px",
                color: "#262626",
              }}
            >
              <strong>{row.guestName}</strong>
              <span style={{ color: "#737373" }}>
                {" · "}
                {formatDateLong(row.checkInISO)} → {formatDateLong(row.checkOutISO)}
                {" · "}
                {row.numNights} {row.numNights === 1 ? "night" : "nights"}
                {" · "}
                {formatMoney(row.totalPrice, row.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function HostDailySummaryEmail({
  dateISO,
  propertyName,
  arrivals,
  departures,
  newBookings,
}: HostDailySummaryEmailProps) {
  return (
    <EmailLayout
      preview={`Daily summary for ${propertyName} — ${formatDateLong(dateISO)}`}
      heading={`Daily summary — ${formatDateLong(dateISO)}`}
      footer={<>Sent by Staithes — {propertyName}</>}
    >
      <Paragraph>Here&rsquo;s what&rsquo;s happening today.</Paragraph>
      <Section title="Today's arrivals" rows={arrivals} />
      <Section title="Today's check-outs" rows={departures} />
      <Section title="New bookings (last 24h)" rows={newBookings} />
    </EmailLayout>
  );
}
