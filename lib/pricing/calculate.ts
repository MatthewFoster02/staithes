import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
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
}

export interface NightlyRate {
  date: string; // YYYY-MM-DD
  rate: string; // serialised decimal
}

// Mirrors the BookingPriceSnapshot model so this object can be used
// directly when creating the row in Phase 2.6 / 2.9. Decimal-typed
// fields are returned as decimal-string values to keep the JSON wire
// format precise (no float rounding) and consistent with how Prisma
// itself serialises Decimal columns.
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

// Phase 2 implementation: flat nightly rate, no pricing rules, no
// discounts, no service fee, no tax. The full rules engine lands in
// Phase 7 — but the breakdown shape it produces will be identical, so
// nothing downstream needs to change when rules are added.
export async function calculatePrice(
  args: CalculatePriceArgs,
): Promise<CalculatePriceResult> {
  const { propertyId, checkIn, checkOut } = args;
  const numAdults = args.numAdults;
  const numChildren = args.numChildren ?? 0;
  const totalGuests = numAdults + numChildren;

  const numNights = differenceInDays(checkOut, checkIn);
  if (numNights < 1) {
    return {
      ok: false,
      error: "invalid_range",
      message: "Check-out must be after check-in.",
    };
  }
  if (totalGuests < 1) {
    return {
      ok: false,
      error: "invalid_range",
      message: "At least one guest is required.",
    };
  }

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      baseNightlyRate: true,
      cleaningFee: true,
      extraGuestFee: true,
      baseGuestCount: true,
      maxGuests: true,
      currency: true,
    },
  });
  if (!property) {
    return {
      ok: false,
      error: "property_not_found",
      message: "Property not found.",
    };
  }

  if (totalGuests > property.maxGuests) {
    return {
      ok: false,
      error: "too_many_guests",
      message: `Maximum occupancy is ${property.maxGuests} guest${property.maxGuests === 1 ? "" : "s"}.`,
    };
  }

  // Per-night rates: flat for now. When pricing rules land in Phase 7
  // this loop becomes "for each night, find the highest-priority
  // matching rule, fall back to base".
  const baseRate = new Decimal(property.baseNightlyRate);
  const nightlyRates: NightlyRate[] = [];
  for (let i = 0; i < numNights; i++) {
    nightlyRates.push({
      date: formatISODate(addDays(checkIn, i)),
      rate: baseRate.toFixed(2),
    });
  }

  const subtotalAccommodation = baseRate.mul(numNights);
  const cleaningFee = new Decimal(property.cleaningFee);

  // Extra guest fee: per-night for every guest above the base count.
  const extraGuests = Math.max(0, totalGuests - property.baseGuestCount);
  const extraGuestFeePerNight = new Decimal(property.extraGuestFee);
  const extraGuestFeeTotal = extraGuestFeePerNight
    .mul(extraGuests)
    .mul(numNights);

  const total = subtotalAccommodation.plus(cleaningFee).plus(extraGuestFeeTotal);

  return {
    ok: true,
    breakdown: {
      nightlyRates,
      numNights,
      subtotalAccommodation: subtotalAccommodation.toFixed(2),
      cleaningFee: cleaningFee.toFixed(2),
      extraGuestFeeTotal: extraGuestFeeTotal.toFixed(2),
      discountAmount: "0.00",
      discountDescription: null,
      serviceFee: "0.00",
      taxAmount: "0.00",
      taxDescription: null,
      total: total.toFixed(2),
      currency: property.currency,
    },
  };
}
