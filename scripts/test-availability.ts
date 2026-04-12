// Smoke tests for the availability service. Runs against the local
// Supabase DB. Idempotent: creates and tears down a temporary blocked
// date range and a fake confirmed booking, asserts the expected
// availability outcomes, then cleans up.
//
// Run with: npx tsx scripts/test-availability.ts
//
// We're not using a test framework yet — this is a hand-rolled smoke
// test that exits non-zero on the first assertion failure. Good enough
// for Phase 2 confidence; revisit when test count grows.

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import {
  checkAvailability,
  listBlockedDays,
} from "../lib/availability/check";
import { addDays, formatISODate, parseISODate } from "../lib/availability/dates";
import { withPropertyLock } from "../lib/availability/lock";

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
  if (!property) {
    throw new Error("Run `npx prisma db seed` first.");
  }

  // Pick a far-future window so we don't fight any pre-existing fixtures.
  const base = addDays(new Date(), 90);
  const baseStr = formatISODate(base);
  const checkIn = parseISODate(baseStr);
  const checkOut = addDays(checkIn, 5);

  console.log("\n— Clean slate (no conflicts) —");
  {
    const result = await checkAvailability({
      propertyId: property.id,
      checkIn,
      checkOut,
    });
    assert(
      "5-night stay is available",
      result.available === true,
      result,
    );
  }

  console.log("\n— Range validation —");
  {
    const result = await checkAvailability({
      propertyId: property.id,
      checkIn: checkOut,
      checkOut: checkIn, // backwards
    });
    assert(
      "backwards range is rejected",
      result.available === false && result.reason === "invalid_range",
      result,
    );
  }
  {
    const result = await checkAvailability({
      propertyId: property.id,
      checkIn: addDays(new Date(), -10),
      checkOut: addDays(new Date(), -5),
    });
    assert(
      "past dates are rejected",
      result.available === false && result.reason === "in_past",
      result,
    );
  }
  {
    const result = await checkAvailability({
      propertyId: property.id,
      checkIn,
      checkOut: addDays(checkIn, 1), // 1 night, property minStay is 2
    });
    assert(
      "below min stay is rejected",
      result.available === false && result.reason === "min_stay",
      result,
    );
  }
  {
    const result = await checkAvailability({
      propertyId: property.id,
      checkIn,
      checkOut: addDays(checkIn, 30), // 30 nights, property maxStay is 28
    });
    assert(
      "above max stay is rejected",
      result.available === false && result.reason === "max_stay",
      result,
    );
  }

  console.log("\n— Blocked-date conflicts —");
  const blocked = await prisma.blockedDate.create({
    data: {
      propertyId: property.id,
      dateStart: addDays(checkIn, 2),
      dateEnd: addDays(checkIn, 3),
      reason: "smoke test",
    },
  });
  try {
    {
      const result = await checkAvailability({
        propertyId: property.id,
        checkIn,
        checkOut,
      });
      assert(
        "stay overlapping a blocked range is rejected",
        result.available === false && result.reason === "blocked",
        result,
      );
    }
    {
      // Stay that ends exactly on the blocked start day — half-open
      // semantics mean the night before is the last occupied night.
      // Blocked range starts checkIn+2, so a stay [checkIn, checkIn+2)
      // does NOT include the blocked day → should be available.
      const result = await checkAvailability({
        propertyId: property.id,
        checkIn,
        checkOut: addDays(checkIn, 2),
      });
      assert(
        "stay ending the day blocking starts is available (half-open semantics)",
        result.available === true,
        result,
      );
    }
    {
      const result = await listBlockedDays({
        propertyId: property.id,
        from: checkIn,
        to: addDays(checkIn, 5),
      });
      assert(
        "listBlockedDays includes both blocked days",
        result.blocked.includes(formatISODate(addDays(checkIn, 2))) &&
          result.blocked.includes(formatISODate(addDays(checkIn, 3))),
        result,
      );
      assert(
        "listBlockedDays returns empty mine when no guestId",
        result.mine.length === 0,
        result,
      );
    }
  } finally {
    await prisma.blockedDate.delete({ where: { id: blocked.id } });
  }

  console.log("\n— Booking conflicts —");
  // Need a guest row first since Booking has a non-null FK.
  const guest = await prisma.guest.upsert({
    where: { email: "smoketest@example.invalid" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      email: "smoketest@example.invalid",
      firstName: "Smoke",
      lastName: "Test",
    },
  });
  const booking = await prisma.booking.create({
    data: {
      propertyId: property.id,
      guestId: guest.id,
      checkIn: addDays(checkIn, 6),
      checkOut: addDays(checkIn, 9),
      numGuestsAdults: 2,
      status: "confirmed",
      totalPrice: 500,
      currency: "GBP",
      cancellationPolicySnapshot: { kind: "moderate" },
    },
  });
  try {
    {
      // 2-night window fully inside the booking [checkIn+6, checkIn+9)
      // (the 1-night version would fail the property's min-stay check
      // first and never reach the booking-overlap branch).
      const result = await checkAvailability({
        propertyId: property.id,
        checkIn: addDays(checkIn, 7),
        checkOut: addDays(checkIn, 9),
      });
      assert(
        "stay inside a confirmed booking is rejected",
        result.available === false && result.reason === "booked",
        result,
      );
    }
    {
      // Adjacent stay that ends exactly when the booking starts:
      // [checkIn+3, checkIn+6) vs booking [checkIn+6, checkIn+9).
      // Should be available — guest A checks out the morning guest B
      // checks in.
      const result = await checkAvailability({
        propertyId: property.id,
        checkIn: addDays(checkIn, 3),
        checkOut: addDays(checkIn, 6),
      });
      assert(
        "adjacent stay (back-to-back) is available",
        result.available === true,
        result,
      );
    }
  } finally {
    await prisma.booking.delete({ where: { id: booking.id } });
    await prisma.guest.delete({ where: { id: guest.id } });
  }

  console.log("\n— Advisory lock —");
  {
    let ranInsideTransaction = false;
    await withPropertyLock(property.id, async (tx) => {
      const result = await checkAvailability(
        { propertyId: property.id, checkIn, checkOut },
        tx,
      );
      ranInsideTransaction = result.available === true;
    });
    assert("withPropertyLock executes its callback", ranInsideTransaction);
  }

  console.log();
  if (failures > 0) {
    console.error(`✗ ${failures} assertion(s) failed`);
    process.exit(1);
  }
  console.log("✓ All availability smoke tests passed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
