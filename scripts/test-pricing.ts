// Smoke tests for the pricing engine — both the flat-rate base case
// and the full rules engine from Phase 7.2.
//
// Seeded property values:
//   baseNightlyRate: £145.00
//   cleaningFee:     £60.00
//   extraGuestFee:   £15.00 per guest per night
//   baseGuestCount:  4
//   maxGuests:       6
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
  if (condition) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ ${label}`);
    if (detail !== undefined) console.error("    detail:", detail);
    failures++;
  }
}

async function main() {
  const property = await prisma.property.findUnique({ where: { slug: "staithes" } });
  if (!property) throw new Error("Run `npx prisma db seed` first.");

  const checkIn = parseISODate(formatISODate(addDays(new Date(), 90)));

  console.log("\n— Base case (no rules): 5 nights, 2 adults —");
  {
    await prisma.pricingRule.deleteMany({ where: { propertyId: property.id } });
    const result = await calculatePrice({
      propertyId: property.id,
      checkIn,
      checkOut: addDays(checkIn, 5),
      numAdults: 2,
    });
    if (!result.ok) return assert("base case succeeds", false, result);
    const b = result.breakdown;
    assert("subtotal = 725.00", b.subtotalAccommodation === "725.00", b.subtotalAccommodation);
    assert("total = 785.00 (+ 60 cleaning)", b.total === "785.00", b.total);
    assert("discount amount = 0.00", b.discountAmount === "0.00");
  }

  console.log("\n— Seasonal rule overrides nightly rate for matching nights —");
  {
    await prisma.pricingRule.deleteMany({ where: { propertyId: property.id } });
    // 3 of the 5 nights are "peak summer" at £200/night.
    await prisma.pricingRule.create({
      data: {
        propertyId: property.id,
        name: "Peak summer 2026",
        type: "seasonal",
        dateStart: addDays(checkIn, 1),
        dateEnd: addDays(checkIn, 3),
        nightlyRate: 200,
        priority: 10,
        isActive: true,
      },
    });
    const result = await calculatePrice({
      propertyId: property.id,
      checkIn,
      checkOut: addDays(checkIn, 5),
      numAdults: 2,
    });
    if (!result.ok) return assert("seasonal case succeeds", false, result);
    // 2 nights @ 145 + 3 nights @ 200 = 290 + 600 = 890 + 60 = 950
    assert("subtotal = 890.00 with seasonal override", result.breakdown.subtotalAccommodation === "890.00", result.breakdown);
    assert("rate setter applies per night", result.breakdown.nightlyRates[1].rate === "200.00");
    assert("base rate used on non-matching nights", result.breakdown.nightlyRates[0].rate === "145.00");
  }

  console.log("\n— rateMultiplier variant —");
  {
    await prisma.pricingRule.deleteMany({ where: { propertyId: property.id } });
    // 1.5x weekend multiplier for Friday/Saturday (weekdays 5+6 UTC).
    await prisma.pricingRule.create({
      data: {
        propertyId: property.id,
        name: "Weekend 1.5x",
        type: "day_of_week",
        daysOfWeek: [5, 6],
        rateMultiplier: 1.5,
        priority: 5,
        isActive: true,
      },
    });
    // Pick a known-Monday checkIn so we can count weekday hits.
    // 2026-06-01 is a Monday. Stay Monday through Sunday = 6 nights:
    // Mon, Tue, Wed, Thu, Fri, Sat. Weekend = Fri + Sat = 2 nights × 217.50.
    const monday = parseISODate("2026-06-01");
    const result = await calculatePrice({
      propertyId: property.id,
      checkIn: monday,
      checkOut: addDays(monday, 6),
      numAdults: 2,
    });
    if (!result.ok) return assert("day_of_week case succeeds", false, result);
    // 4 weekdays × 145 + 2 weekend × (145 × 1.5 = 217.5) = 580 + 435 = 1015
    assert("subtotal = 1015.00 with weekend multiplier", result.breakdown.subtotalAccommodation === "1015.00", result.breakdown);
  }

  console.log("\n— Priority resolution: higher priority wins —");
  {
    await prisma.pricingRule.deleteMany({ where: { propertyId: property.id } });
    // Both a seasonal rule and a day-of-week rule cover the same night.
    await prisma.pricingRule.create({
      data: {
        propertyId: property.id,
        name: "Generic weekend",
        type: "day_of_week",
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        nightlyRate: 180,
        priority: 1,
        isActive: true,
      },
    });
    await prisma.pricingRule.create({
      data: {
        propertyId: property.id,
        name: "Christmas peak",
        type: "seasonal",
        dateStart: checkIn,
        dateEnd: addDays(checkIn, 10),
        nightlyRate: 300,
        priority: 10,
        isActive: true,
      },
    });
    const result = await calculatePrice({
      propertyId: property.id,
      checkIn,
      checkOut: addDays(checkIn, 2),
      numAdults: 2,
    });
    if (!result.ok) return assert("priority case succeeds", false, result);
    // Higher priority (seasonal, priority=10) wins, so 2 × 300 = 600.
    assert("higher priority wins", result.breakdown.subtotalAccommodation === "600.00", result.breakdown);
  }

  console.log("\n— Length discount applies when nights >= threshold —");
  {
    await prisma.pricingRule.deleteMany({ where: { propertyId: property.id } });
    await prisma.pricingRule.create({
      data: {
        propertyId: property.id,
        name: "Weekly discount",
        type: "length_discount",
        minNightsForDiscount: 7,
        discountPercent: 10,
        priority: 1,
        isActive: true,
      },
    });
    const shortResult = await calculatePrice({
      propertyId: property.id,
      checkIn,
      checkOut: addDays(checkIn, 5),
      numAdults: 2,
    });
    if (!shortResult.ok) return assert("length-discount short case succeeds", false, shortResult);
    assert(
      "5-night stay does not trigger weekly discount",
      shortResult.breakdown.discountAmount === "0.00",
      shortResult.breakdown,
    );

    const longResult = await calculatePrice({
      propertyId: property.id,
      checkIn,
      checkOut: addDays(checkIn, 7),
      numAdults: 2,
    });
    if (!longResult.ok) return assert("length-discount long case succeeds", false, longResult);
    // 7 × 145 = 1015. 10% off = 101.50 discount. Total = 1015 + 60 - 101.50 = 973.50.
    assert(
      "7-night stay triggers 10% discount = 101.50",
      longResult.breakdown.discountAmount === "101.50",
      longResult.breakdown,
    );
    assert(
      "discount description populated",
      longResult.breakdown.discountDescription === "Weekly discount",
    );
    assert(
      "total = 973.50 after discount",
      longResult.breakdown.total === "973.50",
      longResult.breakdown,
    );
  }

  console.log("\n— Last-minute discount —");
  {
    await prisma.pricingRule.deleteMany({ where: { propertyId: property.id } });
    await prisma.pricingRule.create({
      data: {
        propertyId: property.id,
        name: "Last-minute 15%",
        type: "last_minute",
        daysBeforeCheckin: 3,
        discountPercent: 15,
        priority: 1,
        isActive: true,
      },
    });
    // Simulate booking 2 days before check-in.
    const nearCheckIn = addDays(new Date(), 2);
    const nearResult = await calculatePrice({
      propertyId: property.id,
      checkIn: nearCheckIn,
      checkOut: addDays(nearCheckIn, 3),
      numAdults: 2,
    });
    if (!nearResult.ok) return assert("last-minute succeeds", false, nearResult);
    // 3 × 145 = 435. 15% off = 65.25. Total = 435 + 60 - 65.25 = 429.75.
    assert(
      "last-minute discount applied",
      nearResult.breakdown.discountAmount === "65.25",
      nearResult.breakdown,
    );

    // Simulate booking 30 days out — no discount.
    const farCheckIn = addDays(new Date(), 30);
    const farResult = await calculatePrice({
      propertyId: property.id,
      checkIn: farCheckIn,
      checkOut: addDays(farCheckIn, 3),
      numAdults: 2,
    });
    if (!farResult.ok) return assert("far case succeeds", false, farResult);
    assert(
      "far-future booking does not get last-minute discount",
      farResult.breakdown.discountAmount === "0.00",
      farResult.breakdown,
    );
  }

  console.log("\n— Early-bird discount —");
  {
    await prisma.pricingRule.deleteMany({ where: { propertyId: property.id } });
    await prisma.pricingRule.create({
      data: {
        propertyId: property.id,
        name: "Early-bird 20%",
        type: "early_bird",
        daysAdvanceBooking: 90,
        discountPercent: 20,
        priority: 1,
        isActive: true,
      },
    });
    const result = await calculatePrice({
      propertyId: property.id,
      checkIn: addDays(new Date(), 120),
      checkOut: addDays(new Date(), 123),
      numAdults: 2,
    });
    if (!result.ok) return assert("early-bird succeeds", false, result);
    assert(
      "early-bird discount applied to distant booking",
      Number(result.breakdown.discountAmount) > 0,
      result.breakdown,
    );
  }

  // Cleanup
  await prisma.pricingRule.deleteMany({ where: { propertyId: property.id } });

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
