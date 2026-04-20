import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { formatISODate } from "@/lib/availability/dates";
import {
  PricingRuleForm,
  type PricingRuleInitialValues,
} from "@/components/admin/pricing-rule-form";

export const metadata: Metadata = {
  title: "Admin · Edit pricing rule",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPricingRulePage({ params }: PageProps) {
  const { id } = await params;
  const rule = await prisma.pricingRule.findUnique({ where: { id } });
  if (!rule) notFound();

  // Serialise the Prisma row into the form's initial-values shape.
  // Decimals become strings, dates become YYYY-MM-DD, nullable
  // numeric fields stay string/null so the text inputs can be empty.
  const initial: PricingRuleInitialValues = {
    id: rule.id,
    name: rule.name,
    type: rule.type,
    priority: rule.priority,
    dateStart: rule.dateStart ? formatISODate(rule.dateStart) : null,
    dateEnd: rule.dateEnd ? formatISODate(rule.dateEnd) : null,
    daysOfWeek: rule.daysOfWeek ?? [],
    nightlyRate: rule.nightlyRate !== null ? String(rule.nightlyRate) : null,
    rateMultiplier: rule.rateMultiplier !== null ? String(rule.rateMultiplier) : null,
    minNightsForDiscount:
      rule.minNightsForDiscount !== null ? String(rule.minNightsForDiscount) : null,
    discountPercent:
      rule.discountPercent !== null ? String(rule.discountPercent) : null,
    daysBeforeCheckin:
      rule.daysBeforeCheckin !== null ? String(rule.daysBeforeCheckin) : null,
    daysAdvanceBooking:
      rule.daysAdvanceBooking !== null ? String(rule.daysAdvanceBooking) : null,
  };

  return (
    <article className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/admin/pricing"
        className="mb-6 inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900"
      >
        <ArrowLeftIcon className="size-4" />
        Back to pricing rules
      </Link>

      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Edit pricing rule</h1>

      <PricingRuleForm initial={initial} />
    </article>
  );
}
