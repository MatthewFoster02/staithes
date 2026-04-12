// Smoke test for the expireStalePendingBookings sweep.
//
// Creates a synthetic guest + a pending booking with createdAt set to
// 31 minutes ago, runs the sweep, asserts the booking is now cancelled
// with the right reason, then cleans up.
//
// Run with: npx tsx scripts/test-expire-bookings.ts

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import {
  expireStalePendingBookings,
  PENDING_TTL_MINUTES,
} from "../lib/booking/expire";
import { addDays } from "../lib/availability/dates";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

let failures = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}`);
    if (detail !== undefined) console.error("    detail:", detail);
    failures++;
  }
}

async function main() {
  const property = await prisma.property.findUnique({ where: { slug: "staithes" } });
  if (!property) throw new Error("Run `npx prisma db seed` first.");

  const guest = await prisma.guest.upsert({
    where: { email: "expire-smoketest@example.invalid" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      email: "expire-smoketest@example.invalid",
      firstName: "Expire",
      lastName: "Test",
    },
  });

  const future = addDays(new Date(), 200);
  const stale = await prisma.booking.create({
    data: {
      propertyId: property.id,
      guestId: guest.id,
      checkIn: future,
      checkOut: addDays(future, 3),
      numGuestsAdults: 2,
      status: "pending",
      totalPrice: 500,
      currency: "GBP",
      cancellationPolicySnapshot: { policy: "moderate" },
      // Force createdAt to (TTL + 1) minutes ago — Prisma's
      // @default(now()) wins over the field on create unless we
      // override it explicitly.
      createdAt: new Date(Date.now() - (PENDING_TTL_MINUTES + 1) * 60 * 1000),
    },
  });

  const fresh = await prisma.booking.create({
    data: {
      propertyId: property.id,
      guestId: guest.id,
      checkIn: addDays(future, 10),
      checkOut: addDays(future, 13),
      numGuestsAdults: 2,
      status: "pending",
      totalPrice: 500,
      currency: "GBP",
      cancellationPolicySnapshot: { policy: "moderate" },
      // Created just now — should NOT be swept.
    },
  });

  try {
    console.log("\n— Sweep stale pending bookings —");
    const result = await expireStalePendingBookings();
    assert(
      "sweep cancels at least one booking",
      result.cancelled >= 1,
      result,
    );

    const refreshedStale = await prisma.booking.findUniqueOrThrow({
      where: { id: stale.id },
    });
    assert(
      "stale booking is cancelled",
      refreshedStale.status === "cancelled",
      { status: refreshedStale.status },
    );
    assert(
      "stale booking has the right reason",
      refreshedStale.cancellationReason === "payment_window_expired",
      { reason: refreshedStale.cancellationReason },
    );
    assert(
      "stale booking has cancelledAt set",
      refreshedStale.cancelledAt !== null,
      { cancelledAt: refreshedStale.cancelledAt },
    );

    const refreshedFresh = await prisma.booking.findUniqueOrThrow({
      where: { id: fresh.id },
    });
    assert(
      "fresh pending booking is untouched",
      refreshedFresh.status === "pending",
      { status: refreshedFresh.status },
    );

    console.log("\n— Re-sweep is a no-op —");
    const second = await expireStalePendingBookings();
    assert(
      "second sweep cancels nothing (idempotent)",
      second.cancelled === 0,
      second,
    );
  } finally {
    await prisma.booking.delete({ where: { id: stale.id } });
    await prisma.booking.delete({ where: { id: fresh.id } });
    await prisma.guest.delete({ where: { id: guest.id } });
  }

  console.log();
  if (failures > 0) {
    console.error(`✗ ${failures} assertion(s) failed`);
    process.exit(1);
  }
  console.log("✓ All expire-bookings smoke tests passed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
