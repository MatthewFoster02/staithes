import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import type { PricingRule } from "@/lib/generated/prisma/client";
import {
  addDays,
  differenceInDays,
  formatISODate,
} from "@/lib/availability/dates";

const { Decimal } = Prisma;
type Decimal = Prisma.Decimal;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CalculatePriceArgs {
  propertyId: string;
  checkIn: Date;
  checkOut: Date;
  numAdults: number;
  numChildren?: number;
  /**
   * "Now" — used for time-sensitive rules (last-minute, early-bird).
   * Defaults to current time. Exposed for deterministic smoke tests.
   */
  now?: Date;
}

export interface NightlyRate {
  date: string; // YYYY-MM-DD
  rate: string; // serialised decimal
}

export interface PriceBreakdown {
  nightlyRates: NightlyRate[];
  numNights: number;
  subtotalAccommodation: string;
  cleaningFee: string;
  extraGuestFeeTotal: string;
  discountAmount: string;
  discountDescription: string | null;
  serviceFee: string;
  taxAmount: string;
  taxDescription: string | null;
  total: string;
  currency: string;
}

export type CalculatePriceResult =
  | { ok: true; breakdown: PriceBreakdown }
  | { ok: false; error: "invalid_range" | "property_not_found" | "too_many_guests"; message: string };

// ---------------------------------------------------------------------------
// Calculator
// ---------------------------------------------------------------------------

// Full pricing engine. Evaluates active PricingRule rows:
//   1. Per-night "rate setters" (seasonal, day_of_week): for each night
//      find the highest-priority matching rule; apply its `nightlyRate`
//      (absolute override) or `rateMultiplier` (× base). If no rule
//      matches, use the property base rate.
//   2. Booking-level "discounts" (last_minute, early_bird, length_discount):
//      at most one applies per booking — the highest-priority matching
//      rule wins. Discount is a percentage off the accommodation subtotal.
//
// Match semantics:
//   - seasonal: night date falls within [dateStart, dateEnd] (inclusive)
//   - day_of_week: night's weekday (0=Sun..6=Sat) is in daysOfWeek
//   - last_minute: (checkIn - now) <= daysBeforeCheckin
//   - early_bird: (checkIn - now) >= daysAdvanceBooking
//   - length_discount: numNights >= minNightsForDiscount
export async function calculatePrice(
  args: CalculatePriceArgs,
): Promise<CalculatePriceResult> {
  const { propertyId, checkIn, checkOut } = args;
  const numAdults = args.numAdults;
  const numChildren = args.numChildren ?? 0;
  const totalGuests = numAdults + numChildren;
  const now = args.now ?? new Date();

  const numNights = differenceInDays(checkOut, checkIn);
  if (numNights < 1) {
    return { ok: false, error: "invalid_range", message: "Check-out must be after check-in." };
  }
  if (totalGuests < 1) {
    return { ok: false, error: "invalid_range", message: "At least one guest is required." };
  }

  const [property, rules] = await Promise.all([
    prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        baseNightlyRate: true,
        cleaningFee: true,
        extraGuestFee: true,
        baseGuestCount: true,
        maxGuests: true,
        currency: true,
      },
    }),
    prisma.pricingRule.findMany({
      where: { propertyId, isActive: true },
      orderBy: { priority: "desc" },
    }),
  ]);

  if (!property) {
    return { ok: false, error: "property_not_found", message: "Property not found." };
  }
  if (totalGuests > property.maxGuests) {
    return {
      ok: false,
      error: "too_many_guests",
      message: `Maximum occupancy is ${property.maxGuests} guest${property.maxGuests === 1 ? "" : "s"}.`,
    };
  }

  const baseRate = new Decimal(property.baseNightlyRate);
  const rateSetters = rules.filter(
    (r) => r.type === "seasonal" || r.type === "day_of_week",
  );
  const discountRules = rules.filter(
    (r) =>
      r.type === "last_minute" ||
      r.type === "early_bird" ||
      r.type === "length_discount",
  );

  // ---- Per-night rate resolution ----
  const nightlyRates: NightlyRate[] = [];
  let subtotalAccommodation = new Decimal(0);
  for (let i = 0; i < numNights; i++) {
    const nightDate = addDays(checkIn, i);
    const rule = firstMatchingRateSetter(rateSetters, nightDate);
    const rate = rule ? resolveRuleRate(rule, baseRate) : baseRate;
    nightlyRates.push({ date: formatISODate(nightDate), rate: rate.toFixed(2) });
    subtotalAccommodation = subtotalAccommodation.plus(rate);
  }

  const cleaningFee = new Decimal(property.cleaningFee);
  const extraGuests = Math.max(0, totalGuests - property.baseGuestCount);
  const extraGuestFeeTotal = new Decimal(property.extraGuestFee)
    .mul(extraGuests)
    .mul(numNights);

  // ---- Discount resolution ----
  const discount = pickBestDiscount(discountRules, { checkIn, numNights, now });
  let discountAmount = new Decimal(0);
  let discountDescription: string | null = null;
  if (discount) {
    const percent = new Decimal(discount.rule.discountPercent ?? 0);
    discountAmount = subtotalAccommodation.mul(percent).div(100);
    discountDescription = discount.rule.name;
  }

  const total = subtotalAccommodation
    .plus(cleaningFee)
    .plus(extraGuestFeeTotal)
    .minus(discountAmount);

  return {
    ok: true,
    breakdown: {
      nightlyRates,
      numNights,
      subtotalAccommodation: subtotalAccommodation.toFixed(2),
      cleaningFee: cleaningFee.toFixed(2),
      extraGuestFeeTotal: extraGuestFeeTotal.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      discountDescription,
      serviceFee: "0.00",
      taxAmount: "0.00",
      taxDescription: null,
      total: total.toFixed(2),
      currency: property.currency,
    },
  };
}

// ---------------------------------------------------------------------------
// Rule matching helpers
// ---------------------------------------------------------------------------

function firstMatchingRateSetter(
  rules: PricingRule[],
  nightDate: Date,
): PricingRule | null {
  for (const rule of rules) {
    if (rule.type === "seasonal" && matchesSeasonal(rule, nightDate)) return rule;
    if (rule.type === "day_of_week" && matchesDayOfWeek(rule, nightDate)) return rule;
  }
  return null;
}

function matchesSeasonal(rule: PricingRule, nightDate: Date): boolean {
  if (!rule.dateStart || !rule.dateEnd) return false;
  return nightDate >= rule.dateStart && nightDate <= rule.dateEnd;
}

function matchesDayOfWeek(rule: PricingRule, nightDate: Date): boolean {
  if (!rule.daysOfWeek || rule.daysOfWeek.length === 0) return false;
  return rule.daysOfWeek.includes(nightDate.getUTCDay());
}

function resolveRuleRate(rule: PricingRule, baseRate: Decimal): Decimal {
  if (rule.nightlyRate !== null) return new Decimal(rule.nightlyRate);
  if (rule.rateMultiplier !== null) {
    return baseRate.mul(new Decimal(rule.rateMultiplier));
  }
  return baseRate;
}

function pickBestDiscount(
  rules: PricingRule[],
  ctx: { checkIn: Date; numNights: number; now: Date },
): { rule: PricingRule } | null {
  for (const rule of rules) {
    if (rule.discountPercent === null) continue;
    if (rule.type === "length_discount") {
      if (rule.minNightsForDiscount !== null && ctx.numNights >= rule.minNightsForDiscount) {
        return { rule };
      }
    } else if (rule.type === "last_minute") {
      if (rule.daysBeforeCheckin !== null) {
        const daysUntil = differenceInDays(ctx.checkIn, ctx.now);
        if (daysUntil <= rule.daysBeforeCheckin) return { rule };
      }
    } else if (rule.type === "early_bird") {
      if (rule.daysAdvanceBooking !== null) {
        const daysUntil = differenceInDays(ctx.checkIn, ctx.now);
        if (daysUntil >= rule.daysAdvanceBooking) return { rule };
      }
    }
  }
  return null;
}
