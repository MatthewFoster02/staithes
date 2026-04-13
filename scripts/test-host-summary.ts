// Smoke test for the daily host summary email.
//
// Tests three scenarios:
//   1. Quiet day (no arrivals/departures/new bookings) → service skips
//      with reason "nothing_to_report".
//   2. Active day (synthetic arrival booking) → dry-run reports
//      sent=true with the right counts.
//   3. Re-run on same day (active) → blocked by the daily log row,
//      reason "already_sent".
//
// Run with:  npx tsx scripts/test-host-summary.ts

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { sendDailyHostSummary } from "../lib/email/host-summary";
import { addDays, todayUTC } from "../lib/availability/dates";

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

const SMOKE_GUEST_ID = "00000000-0000-0000-0000-0000000cc000";

async function main() {
  const property = await prisma.property.findUnique({ where: { slug: "staithes" } });
  if (!property) throw new Error("Run `npx prisma db seed` first.");

  await prisma.guest.upsert({
    where: { email: "host-summary-smoke@example.invalid" },
    update: {},
    create: {
      id: SMOKE_GUEST_ID,
      email: "host-summary-smoke@example.invalid",
      firstName: "Summary",
      lastName: "Test",
    },
  });

  // We use a far-future synthetic date so we don't collide with any
  // real bookings or any existing log row for the actual today.
  const fakeToday = addDays(todayUTC(), 365);

  // Make sure no leftover log row from a previous test run.
  await prisma.hostDailySummaryLog.deleteMany({ where: { date: fakeToday } });

  let createdBookingId: string | null = null;

  try {
    console.log("\n— Quiet day (no activity) —");
    {
      const result = await sendDailyHostSummary({ dryRun: true, forDate: fakeToday });
      assert(
        "skips with reason 'nothing_to_report'",
        result.sent === false && result.reason === "nothing_to_report",
        result,
      );
    }

    console.log("\n— Active day (synthetic arrival) —");
    const booking = await prisma.booking.create({
      data: {
        propertyId: property.id,
        guestId: SMOKE_GUEST_ID,
        checkIn: fakeToday,
        checkOut: addDays(fakeToday, 3),
        numGuestsAdults: 2,
        status: "confirmed",
        totalPrice: 500,
        currency: "GBP",
        cancellationPolicySnapshot: { policy: "moderate" },
      },
    });
    createdBookingId = booking.id;

    {
      const result = await sendDailyHostSummary({ dryRun: true, forDate: fakeToday });
      assert("sends summary on active day", result.sent === true, result);
      if (result.sent) {
        assert("arrivals count = 1", result.arrivals === 1);
      }
    }

    // Note: dry-run intentionally skips writing the log row, so the
    // real (non-dry-run) idempotency path needs its own check.
    console.log("\n— Idempotency check (real send + retry) —");
    {
      // Insert a log row by hand to simulate "already sent today".
      await prisma.hostDailySummaryLog.create({ data: { date: fakeToday } });
      const result = await sendDailyHostSummary({ forDate: fakeToday });
      assert(
        "second invocation skipped via 'already_sent'",
        result.sent === false && result.reason === "already_sent",
        result,
      );
    }
  } finally {
    if (createdBookingId) {
      await prisma.booking.delete({ where: { id: createdBookingId } });
    }
    await prisma.hostDailySummaryLog.deleteMany({ where: { date: fakeToday } });
    await prisma.guest.deleteMany({ where: { id: SMOKE_GUEST_ID } });
  }

  console.log();
  if (failures > 0) {
    console.error(`✗ ${failures} assertion(s) failed`);
    process.exit(1);
  }
  console.log("✓ All host-summary smoke tests passed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
