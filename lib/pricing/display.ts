import type { NightlyRate } from "@/lib/pricing/calculate";

export interface RateGroup {
  /** Decimal-string rate, e.g. "145.00" */
  rate: string;
  nights: number;
  /** rate × nights, already rounded to 2dp for display. */
  subtotal: string;
}

// Groups contiguous nights by rate. "Contiguous" here means
// neighbouring runs in the sorted nightlyRates array — we use it to
// keep the display order roughly chronological. Two nights at £145,
// five at £200, two more at £145 renders as three lines ("£145 × 2",
// "£200 × 5", "£145 × 2"), which matches how the guest actually
// sees the calendar colouring.
export function groupNightlyRates(nightlyRates: NightlyRate[]): RateGroup[] {
  if (nightlyRates.length === 0) return [];
  const groups: RateGroup[] = [];
  for (const night of nightlyRates) {
    const last = groups[groups.length - 1];
    if (last && last.rate === night.rate) {
      last.nights += 1;
      last.subtotal = (Number(last.rate) * last.nights).toFixed(2);
    } else {
      groups.push({
        rate: night.rate,
        nights: 1,
        subtotal: Number(night.rate).toFixed(2),
      });
    }
  }
  return groups;
}
