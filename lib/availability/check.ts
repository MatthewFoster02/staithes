import { prisma } from "@/lib/db/prisma";
import {
  addDays,
  differenceInDays,
  expandClosedRange,
  formatISODate,
  nightsBetween,
  todayUTC,
} from "./dates";
import type { Prisma } from "@/lib/generated/prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AvailabilityReason =
  | "in_past"
  | "invalid_range"
  | "min_stay"
  | "max_stay"
  | "blocked"
  | "booked";

export type AvailabilityResult =
  | { available: true; numNights: number }
  | { available: false; reason: AvailabilityReason; message: string };

export interface CheckAvailabilityArgs {
  propertyId: string;
  checkIn: Date;
  checkOut: Date;
}

// ---------------------------------------------------------------------------
// Core check
// ---------------------------------------------------------------------------

// Determines whether a property is available for the requested half-open
// date range [checkIn, checkOut). This is the read-only check used by the
// calendar and the booking flow before payment. Booking creation must
// re-validate inside a transaction with `withPropertyLock` to be race-safe.
export async function checkAvailability(
  args: CheckAvailabilityArgs,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<AvailabilityResult> {
  const { propertyId, checkIn, checkOut } = args;
  const numNights = differenceInDays(checkOut, checkIn);

  // 1. Range sanity
  if (numNights < 1) {
    return {
      available: false,
      reason: "invalid_range",
      message: "Check-out must be after check-in.",
    };
  }
  if (checkIn < todayUTC()) {
    return {
      available: false,
      reason: "in_past",
      message: "Check-in date is in the past.",
    };
  }

  // 2. Property constraints
  const property = await tx.property.findUnique({
    where: { id: propertyId },
    select: { minStayDefault: true, maxStay: true },
  });
  if (!property) {
    return {
      available: false,
      reason: "invalid_range",
      message: "Property not found.",
    };
  }
  if (numNights < property.minStayDefault) {
    return {
      available: false,
      reason: "min_stay",
      message: `Minimum stay is ${property.minStayDefault} night${property.minStayDefault === 1 ? "" : "s"}.`,
    };
  }
  if (property.maxStay !== null && numNights > property.maxStay) {
    return {
      available: false,
      reason: "max_stay",
      message: `Maximum stay is ${property.maxStay} nights.`,
    };
  }

  // 3. Blocked dates overlap (closed range vs half-open range).
  // Conflict iff blocked.dateStart < checkOut AND blocked.dateEnd >= checkIn.
  const blockedConflict = await tx.blockedDate.findFirst({
    where: {
      propertyId,
      dateStart: { lt: checkOut },
      dateEnd: { gte: checkIn },
    },
    select: { id: true },
  });
  if (blockedConflict) {
    return {
      available: false,
      reason: "blocked",
      message: "Some of these dates are blocked.",
    };
  }

  // 4. Existing booking overlap (half-open vs half-open).
  // Only pending/confirmed bookings hold dates; cancelled and completed
  // bookings free them. Two half-open ranges [a, b) and [c, d) overlap
  // iff a < d AND b > c.
  const bookingConflict = await tx.booking.findFirst({
    where: {
      propertyId,
      status: { in: ["pending", "confirmed"] },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
    },
    select: { id: true },
  });
  if (bookingConflict) {
    return {
      available: false,
      reason: "booked",
      message: "Some of these dates are already booked.",
    };
  }

  return { available: true, numNights };
}

// ---------------------------------------------------------------------------
// Bulk blocked-day list for the calendar component
// ---------------------------------------------------------------------------

export interface ListBlockedDaysArgs {
  propertyId: string;
  from: Date;
  to: Date; // exclusive
}

// Returns a sorted, unique list of YYYY-MM-DD day strings that the
// calendar should render as unavailable, combining manually blocked
// dates and active bookings. The calendar consumes individual days
// rather than ranges so it can apply per-day classes without doing
// overlap math client-side.
export async function listBlockedDays(args: ListBlockedDaysArgs): Promise<string[]> {
  const { propertyId, from, to } = args;
  if (from >= to) return [];

  const [blocked, bookings] = await Promise.all([
    prisma.blockedDate.findMany({
      where: {
        propertyId,
        dateStart: { lt: to },
        dateEnd: { gte: from },
      },
      select: { dateStart: true, dateEnd: true },
    }),
    prisma.booking.findMany({
      where: {
        propertyId,
        status: { in: ["pending", "confirmed"] },
        checkIn: { lt: to },
        checkOut: { gt: from },
      },
      select: { checkIn: true, checkOut: true },
    }),
  ]);

  const days = new Set<string>();

  for (const b of blocked) {
    // Closed range — clamp to [from, to-1]
    const start = b.dateStart < from ? from : b.dateStart;
    const endExclusive = addDays(b.dateEnd, 1);
    const clampedEnd = endExclusive > to ? to : endExclusive;
    for (const day of nightsBetween(start, clampedEnd)) {
      days.add(day);
    }
  }

  for (const b of bookings) {
    // Half-open range — clamp to [from, to)
    const start = b.checkIn < from ? from : b.checkIn;
    const end = b.checkOut > to ? to : b.checkOut;
    for (const day of nightsBetween(start, end)) {
      days.add(day);
    }
  }

  return Array.from(days).sort();
}

// Re-export so route handlers don't need to import from two places.
export { addDays, differenceInDays, expandClosedRange, formatISODate, todayUTC };
