"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type RuleType =
  | "seasonal"
  | "day_of_week"
  | "last_minute"
  | "early_bird"
  | "length_discount";

const TYPE_LABELS: Record<RuleType, string> = {
  seasonal: "Seasonal (specific date range)",
  day_of_week: "Day of week (weekends, etc.)",
  last_minute: "Last-minute discount",
  early_bird: "Early-bird discount",
  length_discount: "Length-of-stay discount",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface PricingRuleInitialValues {
  id: string;
  name: string;
  type: RuleType;
  priority: number;
  dateStart: string | null;
  dateEnd: string | null;
  daysOfWeek: number[];
  nightlyRate: string | null;
  rateMultiplier: string | null;
  minNightsForDiscount: string | null;
  discountPercent: string | null;
  daysBeforeCheckin: string | null;
  daysAdvanceBooking: string | null;
}

interface PricingRuleFormProps {
  /** When provided, the form runs in edit mode — PATCHes /[id] rather
   *  than POSTing the create route. `type` is shown read-only because
   *  changing a rule's type mid-flight would mean different required
   *  fields; if you want a different type, delete and recreate. */
  initial?: PricingRuleInitialValues;
  /** Callback after a successful save (used by the edit page to
   *  navigate back to the list). */
  onSaved?: () => void;
}

// Tiny helper: re-used for labelled form rows.
function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-neutral-700">{label}</span>
      {children}
      {help && <span className="block text-xs text-neutral-500">{help}</span>}
    </label>
  );
}

export function PricingRuleForm({ initial, onSaved }: PricingRuleFormProps = {}) {
  const router = useRouter();
  const isEdit = !!initial;
  const [type, setType] = React.useState<RuleType>(initial?.type ?? "seasonal");
  const [name, setName] = React.useState(initial?.name ?? "");
  const [priority, setPriority] = React.useState(initial?.priority ?? 0);
  const [dateStart, setDateStart] = React.useState(initial?.dateStart ?? "");
  const [dateEnd, setDateEnd] = React.useState(initial?.dateEnd ?? "");
  const [daysOfWeek, setDaysOfWeek] = React.useState<number[]>(initial?.daysOfWeek ?? []);
  const [nightlyRate, setNightlyRate] = React.useState(initial?.nightlyRate ?? "");
  const [rateMultiplier, setRateMultiplier] = React.useState(initial?.rateMultiplier ?? "");
  const [minNightsForDiscount, setMinNights] = React.useState(initial?.minNightsForDiscount ?? "");
  const [discountPercent, setDiscountPercent] = React.useState(initial?.discountPercent ?? "");
  const [daysBeforeCheckin, setDaysBefore] = React.useState(initial?.daysBeforeCheckin ?? "");
  const [daysAdvanceBooking, setDaysAhead] = React.useState(initial?.daysAdvanceBooking ?? "");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function toggleDay(day: number) {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  }

  function resetAllFields() {
    setName("");
    setPriority(0);
    setDateStart("");
    setDateEnd("");
    setDaysOfWeek([]);
    setNightlyRate("");
    setRateMultiplier("");
    setMinNights("");
    setDiscountPercent("");
    setDaysBefore("");
    setDaysAhead("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    // Edit mode sends every editable field (including nulls to clear
    // previously-set ones) so the PATCH handler has a clean picture of
    // intended state. Create mode only sends fields that are set.
    const body: Record<string, unknown> = isEdit
      ? {
          name,
          priority,
          dateStart: type === "seasonal" ? dateStart || null : undefined,
          dateEnd: type === "seasonal" ? dateEnd || null : undefined,
          daysOfWeek: type === "day_of_week" ? daysOfWeek : undefined,
          nightlyRate:
            type === "seasonal" || type === "day_of_week"
              ? nightlyRate
                ? Number(nightlyRate)
                : null
              : undefined,
          rateMultiplier:
            type === "seasonal" || type === "day_of_week"
              ? rateMultiplier
                ? Number(rateMultiplier)
                : null
              : undefined,
          minNightsForDiscount:
            type === "length_discount"
              ? minNightsForDiscount
                ? Number(minNightsForDiscount)
                : null
              : undefined,
          discountPercent:
            type === "last_minute" || type === "early_bird" || type === "length_discount"
              ? discountPercent
                ? Number(discountPercent)
                : null
              : undefined,
          daysBeforeCheckin:
            type === "last_minute"
              ? daysBeforeCheckin
                ? Number(daysBeforeCheckin)
                : null
              : undefined,
          daysAdvanceBooking:
            type === "early_bird"
              ? daysAdvanceBooking
                ? Number(daysAdvanceBooking)
                : null
              : undefined,
        }
      : { name, type, priority, isActive: true };

    if (!isEdit) {
      if (type === "seasonal") {
        body.dateStart = dateStart || null;
        body.dateEnd = dateEnd || null;
        if (nightlyRate) body.nightlyRate = Number(nightlyRate);
        if (rateMultiplier) body.rateMultiplier = Number(rateMultiplier);
      } else if (type === "day_of_week") {
        body.daysOfWeek = daysOfWeek;
        if (nightlyRate) body.nightlyRate = Number(nightlyRate);
        if (rateMultiplier) body.rateMultiplier = Number(rateMultiplier);
      } else if (type === "last_minute") {
        if (daysBeforeCheckin) body.daysBeforeCheckin = Number(daysBeforeCheckin);
        if (discountPercent) body.discountPercent = Number(discountPercent);
      } else if (type === "early_bird") {
        if (daysAdvanceBooking) body.daysAdvanceBooking = Number(daysAdvanceBooking);
        if (discountPercent) body.discountPercent = Number(discountPercent);
      } else if (type === "length_discount") {
        if (minNightsForDiscount) body.minNightsForDiscount = Number(minNightsForDiscount);
        if (discountPercent) body.discountPercent = Number(discountPercent);
      }
    }

    const url = isEdit
      ? `/api/admin/pricing-rules/${initial!.id}`
      : "/api/admin/pricing-rules";
    const method = isEdit ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not save rule.");
        setSubmitting(false);
        return;
      }
      if (!isEdit) {
        resetAllFields();
        router.refresh();
      } else {
        // On edit success, bounce back to the list so the host sees
        // their change reflected alongside the other rules. The
        // refresh ensures the list shows fresh data.
        router.push("/admin/pricing");
        router.refresh();
      }
      setSubmitting(false);
      if (onSaved) onSaved();
    } catch {
      setError("Network error.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5">
      <h3 className="text-base font-semibold">
        {isEdit ? "Edit pricing rule" : "New pricing rule"}
      </h3>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" help="Internal label — shown in the list below.">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Peak summer 2026"
            required
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field
          label="Type"
          help={isEdit ? "Type can't change — delete and recreate if you need a different one." : undefined}
        >
          <select
            value={type}
            onChange={(e) => setType(e.target.value as RuleType)}
            disabled={isEdit}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-neutral-100"
          >
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Type-specific fields. Each block only renders for its type. */}
      {type === "seasonal" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="From">
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="To">
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>
      )}
      {type === "day_of_week" && (
        <Field label="Days">
          <div className="flex flex-wrap gap-2">
            {DAY_LABELS.map((label, day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                  daysOfWeek.includes(day)
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
      )}
      {(type === "seasonal" || type === "day_of_week") && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nightly rate (£)" help="Set an absolute nightly rate for matching nights.">
            <input
              type="number"
              min={0}
              step={1}
              value={nightlyRate}
              onChange={(e) => {
                setNightlyRate(e.target.value);
                if (e.target.value) setRateMultiplier("");
              }}
              placeholder="e.g. 200"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Or rate multiplier" help="e.g. 1.5 for a 50% weekend uplift. Multiplies the base rate.">
            <input
              type="number"
              min={0}
              step={0.01}
              value={rateMultiplier}
              onChange={(e) => {
                setRateMultiplier(e.target.value);
                if (e.target.value) setNightlyRate("");
              }}
              placeholder="e.g. 1.5"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>
      )}
      {type === "last_minute" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Days before check-in" help="Book within this many days of check-in to qualify.">
            <input
              type="number"
              min={1}
              value={daysBeforeCheckin}
              onChange={(e) => setDaysBefore(e.target.value)}
              placeholder="e.g. 7"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Discount %">
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
              placeholder="e.g. 15"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>
      )}
      {type === "early_bird" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Days in advance" help="Book at least this many days ahead to qualify.">
            <input
              type="number"
              min={1}
              value={daysAdvanceBooking}
              onChange={(e) => setDaysAhead(e.target.value)}
              placeholder="e.g. 90"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Discount %">
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
              placeholder="e.g. 10"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>
      )}
      {type === "length_discount" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Minimum nights" help="Stays of this length or longer get the discount.">
            <input
              type="number"
              min={1}
              value={minNightsForDiscount}
              onChange={(e) => setMinNights(e.target.value)}
              placeholder="e.g. 7"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Discount %">
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
              placeholder="e.g. 10"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>
      )}

      <Field label="Priority" help="Higher wins when multiple rules match the same night (0–1000).">
        <input
          type="number"
          min={0}
          max={1000}
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value))}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : isEdit ? "Save changes" : "Add rule"}
        </Button>
      </div>
    </form>
  );
}
