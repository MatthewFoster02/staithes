// Tiny date helpers used by the availability and pricing services.
// Stays minimal — if date logic gets gnarly later, switch to date-fns.
//
// Convention throughout: dates are treated as calendar days in UTC.
// Booking ranges are half-open [checkIn, checkOut) — guest checks in
// on `checkIn` and out on `checkOut`, occupying nights `checkIn` …
// `checkOut - 1`. BlockedDate ranges are closed [dateStart, dateEnd]
// per the data model doc.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseISODate(value: string): Date {
  if (!ISO_DATE.test(value)) {
    throw new Error(`Invalid ISO date: ${value} (expected YYYY-MM-DD)`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ISO date: ${value}`);
  }
  return date;
}

export function formatISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function differenceInDays(later: Date, earlier: Date): number {
  const ms = later.getTime() - earlier.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

// Returns the array of calendar days occupied by a half-open booking
// range [checkIn, checkOut), i.e. the nights the guest stays. Useful
// for the calendar component which wants individual day strings.
export function nightsBetween(checkIn: Date, checkOut: Date): string[] {
  const out: string[] = [];
  for (let d = new Date(checkIn); d < checkOut; d = addDays(d, 1)) {
    out.push(formatISODate(d));
  }
  return out;
}

// Expands a closed [start, end] range into individual day strings.
export function expandClosedRange(start: Date, end: Date): string[] {
  const out: string[] = [];
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    out.push(formatISODate(d));
  }
  return out;
}

export function todayUTC(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}
