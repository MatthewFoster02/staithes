// Smoke test for the automated email scheduler.
//
// Creates synthetic confirmed bookings with various date offsets so
// that each email type fires once, runs the scheduler in dry-run
// mode (so no real email is sent), and asserts that the right
// AutomatedEmailLog rows exist after.
//
// Re-running the scheduler should be a no-op because of the unique
// (booking_id, email_type) constraint.
//
// Run with:  npx tsx scripts/test-email-scheduler.ts

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { processBookingEmails } from "../lib/email/scheduler";
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

const SMOKE_GUEST_ID = "00000000-0000-0000-0000-0000000bb000";

interface Fixture {
  label: string;
  checkInOffset: number;
  numNights: number;
  expectedType:
    | "pre_arrival"
    | "check_in_reminder"
    | "mid_stay"
    | "check_out_reminder"
    | "post_stay_thanks";
}

const FIXTURES: Fixture[] = [
  { label: "pre-arrival (check-in in 2 days)", checkInOffset: 2, numNights: 3, expectedType: "pre_arrival" },
  { label: "check-in reminder (today)", checkInOffset: 0, numNights: 3, expectedType: "check_in_reminder" },
  { label: "mid-stay (day 3 of 7)", checkInOffset: -2, numNights: 7, expectedType: "mid_stay" },
  { label: "check-out reminder (tomorrow)", checkInOffset: -2, numNights: 3, expectedType: "check_out_reminder" },
  { label: "post-stay thanks (yesterday)", checkInOffset: -4, numNights: 3, expectedType: "post_stay_thanks" },
];

async function main() {
  const property = await prisma.property.findUnique({ where: { slug: "staithes" } });
  if (!property) throw new Error("Run `npx prisma db seed` first.");

  await prisma.guest.upsert({
    where: { email: "scheduler-smoke@example.invalid" },
    update: {},
    create: {
      id: SMOKE_GUEST_ID,
      email: "scheduler-smoke@example.invalid",
      firstName: "Scheduler",
      lastName: "Test",
    },
  });

  const today = todayUTC();
  const createdBookingIds: string[] = [];

  // Create one booking per fixture.
  for (const fixture of FIXTURES) {
    const checkIn = addDays(today, fixture.checkInOffset);
    const checkOut = addDays(checkIn, fixture.numNights);
    const booking = await prisma.booking.create({
      data: {
        propertyId: property.id,
        guestId: SMOKE_GUEST_ID,
        checkIn,
        checkOut,
        numGuestsAdults: 2,
        status: "confirmed",
        totalPrice: 500,
        currency: "GBP",
        cancellationPolicySnapshot: { policy: "moderate" },
      },
    });
    createdBookingIds.push(booking.id);
  }

  try {
    console.log("\n— First sweep (dry-run) —");
    const first = await processBookingEmails({ dryRun: true });
    console.log("  result:", first);
    assert("no errors on first sweep", first.errors === 0);

    // Verify each fixture got the email type it expected.
    for (let i = 0; i < FIXTURES.length; i++) {
      const fixture = FIXTURES[i];
      const bookingId = createdBookingIds[i];
      const log = await prisma.automatedEmailLog.findUnique({
        where: {
          bookingId_emailType: {
            bookingId,
            emailType: fixture.expectedType,
          },
        },
      });
      assert(
        `${fixture.label} → log row exists with type=${fixture.expectedType}`,
        log !== null,
      );
    }

    console.log("\n— Second sweep (idempotent) —");
    const second = await processBookingEmails({ dryRun: true });
    console.log("  result:", second);
    const totalSent = Object.values(second.sent).reduce((a, b) => a + b, 0);
    assert("second sweep is a no-op (zero sends)", totalSent === 0, second);
  } finally {
    // Cleanup
    await prisma.automatedEmailLog.deleteMany({
      where: { bookingId: { in: createdBookingIds } },
    });
    await prisma.booking.deleteMany({
      where: { id: { in: createdBookingIds } },
    });
    await prisma.guest.deleteMany({ where: { id: SMOKE_GUEST_ID } });
  }

  console.log();
  if (failures > 0) {
    console.error(`✗ ${failures} assertion(s) failed`);
    process.exit(1);
  }
  console.log("✓ All scheduler smoke tests passed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
