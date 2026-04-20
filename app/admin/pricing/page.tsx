import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import type { PricingRule } from "@/lib/generated/prisma/client";
import { formatISODate } from "@/lib/availability/dates";
import { PricingRuleForm } from "@/components/admin/pricing-rule-form";
import {
  PricingRuleRow,
  type PricingRuleRowData,
} from "@/components/admin/pricing-rule-row";

export const metadata: Metadata = {
  title: "Admin · Pricing",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Build a human-readable one-liner describing the rule's effect.
// Lives here rather than on the Row component so the SSR page has a
// single source of truth and the tiny client row doesn't need the
// whole PricingRule type.
function summariseRule(rule: PricingRule): string {
  switch (rule.type) {
    case "seasonal": {
      const range = rule.dateStart && rule.dateEnd
        ? `${formatISODate(rule.dateStart)} → ${formatISODate(rule.dateEnd)}`
        : "no date range";
      return `${range} · ${describeRate(rule)}`;
    }
    case "day_of_week": {
      const days = rule.daysOfWeek?.map((d) => DAY_LABELS[d]).join(", ") ?? "no days";
      return `${days} · ${describeRate(rule)}`;
    }
    case "last_minute":
      return `Within ${rule.daysBeforeCheckin} days of check-in · ${rule.discountPercent}% off`;
    case "early_bird":
      return `${rule.daysAdvanceBooking}+ days ahead · ${rule.discountPercent}% off`;
    case "length_discount":
      return `${rule.minNightsForDiscount}+ nights · ${rule.discountPercent}% off`;
  }
}

function describeRate(rule: PricingRule): string {
  if (rule.nightlyRate !== null) return `£${Number(rule.nightlyRate).toFixed(0)} / night`;
  if (rule.rateMultiplier !== null) return `${Number(rule.rateMultiplier)}× base rate`;
  return "no rate";
}

export default async function AdminPricingPage() {
  const rules = await prisma.pricingRule.findMany({
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });

  const rows: PricingRuleRowData[] = rules.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    priority: r.priority,
    isActive: r.isActive,
    summary: summariseRule(r),
  }));

  return (
    <article className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Pricing rules</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Overrides to the base nightly rate. When multiple rules match the
          same night, the highest-priority one wins. Discounts apply to the
          accommodation subtotal.
        </p>
      </header>

      <PricingRuleForm />

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Existing rules ({rules.length})
        </h2>
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
            No pricing rules yet. Bookings use the property&rsquo;s base rate.
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
            {rows.map((row) => (
              <PricingRuleRow key={row.id} rule={row} />
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
