// Smoke tests for the pricing engine. Runs against the local DB and
// the seeded property values:
//   baseNightlyRate: £145.00
//   cleaningFee:     £60.00
//   extraGuestFee:   £15.00 per guest per night
//   baseGuestCount:  4
//   maxGuests:       6
//   minStay:         2, maxStay: 28
//
// Run with: npx tsx scripts/test-pricing.ts

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { calculatePrice } from "../lib/pricing/calculate";
import { addDays, parseISODate, formatISODate } from "../lib/availability/dates";

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

  const checkIn = parseISODate(formatISODate(addDays(new Date(), 90)));

  console.log("\n— Base case: 5 nights, 2 adults, no extras —");
  {
    const result = await calculatePrice({
      propertyId: property.id,
      checkIn,
      checkOut: addDays(checkIn, 5),
      numAdults: 2,
    });
    if (!result.ok) {
      assert("base case succeeds", false, result);
      return;
    }
    const b = result.breakdown;
    // 145 * 5 = 725 accommodation, 60 cleaning, 0 extra guest, total 785
    assert("numNights = 5", b.numNights === 5, b.numNights);
    assert("nightlyRates length = 5", b.nightlyRates.length === 5);
    assert("subtotalAccommodation = 725.00", b.subtotalAccommodation === "725.00", b.subtotalAccommodation);
    assert("cleaningFee = 60.00", b.cleaningFee === "60.00");
    assert("extraGuestFeeTotal = 0.00", b.extraGuestFeeTotal === "0.00");
    assert("total = 785.00", b.total === "785.00", b.total);
    assert("currency = GBP", b.currency === "GBP");
  }

  console.log("\n— Below base guest count: 4 adults still no extra fee —");
  {
    const result = await calculatePrice({
      propertyId: property.id,
      checkIn,
      checkOut: addDays(checkIn, 3),
      numAdults: 4,
    });
    if (!result.ok) return assert("4-guest case succeeds", false, result);
    assert(
      "extraGuestFeeTotal = 0.00 at base guest count",
      result.breakdown.extraGuestFeeTotal === "0.00",
      result.breakdown,
    );
  }

  console.log("\n— Above base guest count: 6 guests over 3 nights —");
  {
    const result = await calculatePrice({
      propertyId: property.id,
      checkIn,
      checkOut: addDays(checkIn, 3),
      numAdults: 4,
      numChildren: 2,
    });
    if (!result.ok) return assert("6-guest case succeeds", false, result);
    const b = result.breakdown;
    // 2 extra guests * £15 * 3 nights = 90
    // 145 * 3 + 60 + 90 = 585
    assert("extraGuestFeeTotal = 90.00", b.extraGuestFeeTotal === "90.00", b.extraGuestFeeTotal);
    assert("total = 585.00", b.total === "585.00", b.total);
  }

  console.log("\n— Single night still respects all fees (despite property minStay) —");
  {
    // Pricing engine doesn't enforce min-stay; that's availability's
    // job. Calculator should return a valid 1-night breakdown.
    const result = await calculatePrice({
      propertyId: property.id,
      checkIn,
      checkOut: addDays(checkIn, 1),
      numAdults: 2,
    });
    if (!result.ok) return assert("1-night case succeeds", false, result);
    // 145 + 60 = 205
    assert("1-night total = 205.00", result.breakdown.total === "205.00", result.breakdown.total);
  }

  console.log("\n— Range and guest validation —");
  {
    const r = await calculatePrice({
      propertyId: property.id,
      checkIn,
      checkOut: checkIn,
      numAdults: 2,
    });
    assert("zero-night range rejected", !r.ok && r.error === "invalid_range");
  }
  {
    const r = await calculatePrice({
      propertyId: property.id,
      checkIn,
      checkOut: addDays(checkIn, 3),
      numAdults: 0,
    });
    assert("zero guests rejected", !r.ok && r.error === "invalid_range");
  }
  {
    const r = await calculatePrice({
      propertyId: property.id,
      checkIn,
      checkOut: addDays(checkIn, 3),
      numAdults: 7, // maxGuests is 6
    });
    assert("over max guests rejected", !r.ok && r.error === "too_many_guests");
  }

  console.log("\n— Per-night array dates align with the input range —");
  {
    const result = await calculatePrice({
      propertyId: property.id,
      checkIn,
      checkOut: addDays(checkIn, 3),
      numAdults: 2,
    });
    if (!result.ok) return assert("3-night dates check succeeds", false, result);
    const dates = result.breakdown.nightlyRates.map((n) => n.date);
    assert(
      "first night = checkIn",
      dates[0] === formatISODate(checkIn),
      dates,
    );
    assert(
      "last night = checkOut - 1 (half-open)",
      dates[2] === formatISODate(addDays(checkIn, 2)),
      dates,
    );
  }

  console.log();
  if (failures > 0) {
    console.error(`✗ ${failures} assertion(s) failed`);
    process.exit(1);
  }
  console.log("✓ All pricing smoke tests passed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
