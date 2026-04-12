import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

// Postgres advisory locks held for the duration of a transaction. The
// lock key is derived from a property UUID via `hashtextextended` so
// concurrent booking attempts on the *same* property serialise, while
// other properties stay unaffected.
//
// Use this whenever you need an atomic
//   1. re-check availability under lock
//   2. create the Booking row
// pair, e.g. inside the booking-creation service. Read-only checks
// (the calendar, the price preview) don't need the lock.
//
// Usage:
//
//   await withPropertyLock(propertyId, async (tx) => {
//     const result = await checkAvailability({ propertyId, ... }, tx);
//     if (!result.available) throw new BookingUnavailableError(result);
//     return tx.booking.create({ data: { ... } });
//   });

export async function withPropertyLock<T>(
  propertyId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // hashtextextended yields a stable bigint that fits the
    // pg_advisory_xact_lock(bigint) signature, and is namespaced by
    // a fixed prefix so we never collide with locks taken elsewhere.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`property:${propertyId}`}, 0))`;
    return fn(tx);
  });
}
