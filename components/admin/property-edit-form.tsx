"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export interface RefundTierRow {
  minDays: number;
  percent: number;
}

export interface PropertyEditValues {
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  propertyType: string;
  addressFull: string;
  addressApprox: string;
  latitude: string;
  longitude: string;
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: string;
  checkInTime: string;
  checkOutTime: string;
  minStayDefault: number;
  maxStay: string;
  baseNightlyRate: string;
  cleaningFee: string;
  extraGuestFee: string;
  baseGuestCount: number;
  currency: string;
  houseRules: string;
  cancellationPolicy: string;
  cancellationTiers: RefundTierRow[];
  status: string;
  instantBookingEnabled: boolean;
}

// Preset tiers by policy name. Mirrors lib/booking/cancel.ts
// PRESET_TIERS — duplicated in the client bundle so the preset
// buttons don't need a round-trip.
const PRESET_TIERS: Record<string, RefundTierRow[]> = {
  flexible: [{ minDays: 1, percent: 100 }],
  moderate: [
    { minDays: 5, percent: 100 },
    { minDays: 3, percent: 50 },
  ],
  strict: [
    { minDays: 14, percent: 100 },
    { minDays: 7, percent: 50 },
  ],
};

// Section primitive used across the form for consistent spacing.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5">
      <h2 className="mb-4 text-base font-semibold">{title}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  help,
  children,
  span = 1,
  tone = "neutral",
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
  span?: 1 | 2;
  tone?: "neutral" | "error";
}) {
  return (
    <label className={`block space-y-1 ${span === 2 ? "sm:col-span-2" : ""}`}>
      <span className="text-sm font-medium text-neutral-700">{label}</span>
      {children}
      {help && (
        <span
          className={`block text-xs ${tone === "error" ? "text-red-600" : "text-neutral-500"}`}
        >
          {help}
        </span>
      )}
    </label>
  );
}

const inputClass = "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm";

function sortTiers(tiers: RefundTierRow[]): RefundTierRow[] {
  return [...tiers].sort((a, b) => b.minDays - a.minDays);
}

export function PropertyEditForm({ initial }: { initial: PropertyEditValues }) {
  const router = useRouter();
  const [values, setValues] = React.useState(initial);
  const [submitting, setSubmitting] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function update<K extends keyof PropertyEditValues>(key: K, value: PropertyEditValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSavedAt(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const body: Record<string, unknown> = {
      name: values.name,
      slug: values.slug,
      description: values.description,
      shortDescription: values.shortDescription || null,
      propertyType: values.propertyType,
      addressFull: values.addressFull,
      addressApprox: values.addressApprox,
      latitude: Number(values.latitude),
      longitude: Number(values.longitude),
      maxGuests: values.maxGuests,
      bedrooms: values.bedrooms,
      beds: values.beds,
      bathrooms: Number(values.bathrooms),
      checkInTime: values.checkInTime,
      checkOutTime: values.checkOutTime,
      minStayDefault: values.minStayDefault,
      maxStay: values.maxStay ? Number(values.maxStay) : null,
      baseNightlyRate: Number(values.baseNightlyRate),
      cleaningFee: Number(values.cleaningFee),
      extraGuestFee: Number(values.extraGuestFee),
      baseGuestCount: values.baseGuestCount,
      currency: values.currency,
      houseRules: values.houseRules || null,
      cancellationPolicy: values.cancellationPolicy,
      cancellationTiers: sortTiers(values.cancellationTiers),
      status: values.status,
      instantBookingEnabled: values.instantBookingEnabled,
    };

    try {
      const res = await fetch("/api/admin/property", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not save.");
        setSubmitting(false);
        return;
      }
      setSavedAt(new Date());
      router.refresh();
      setSubmitting(false);
    } catch {
      setError("Network error.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Section title="Basics">
        <Field label="Name">
          <input
            type="text"
            value={values.name}
            onChange={(e) => update("name", e.target.value)}
            required
            className={inputClass}
          />
        </Field>
        <Field
          label="Slug"
          tone={values.slug.length > 0 && !/^[a-z0-9-]+$/.test(values.slug) ? "error" : "neutral"}
          help={
            values.slug.length > 0 && !/^[a-z0-9-]+$/.test(values.slug)
              ? "Only lowercase letters, numbers, and hyphens are allowed."
              : "Used in URLs. Lowercase letters, numbers, hyphens."
          }
        >
          <input
            type="text"
            value={values.slug}
            onChange={(e) => update("slug", e.target.value)}
            required
            pattern="[a-z0-9-]+"
            aria-invalid={values.slug.length > 0 && !/^[a-z0-9-]+$/.test(values.slug)}
            className={`${inputClass} aria-invalid:border-red-500 aria-invalid:ring-1 aria-invalid:ring-red-300`}
          />
        </Field>
        <Field label="Short description" help="Shown on search snippets and OG cards." span={2}>
          <input
            type="text"
            value={values.shortDescription}
            onChange={(e) => update("shortDescription", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Description" span={2}>
          <textarea
            value={values.description}
            onChange={(e) => update("description", e.target.value)}
            rows={6}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Property type">
          <select
            value={values.propertyType}
            onChange={(e) => update("propertyType", e.target.value)}
            className={inputClass}
          >
            {["house", "flat", "cottage", "cabin", "other"].map((t) => (
              <option key={t} value={t}>
                {t[0].toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status" help="Hidden properties don't appear on the public page.">
          <select
            value={values.status}
            onChange={(e) => update("status", e.target.value)}
            className={inputClass}
          >
            {["active", "paused", "hidden"].map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Capacity">
        <Field label="Max guests">
          <input
            type="number"
            min={1}
            max={50}
            value={values.maxGuests}
            onChange={(e) => update("maxGuests", Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="Base guest count" help="Guests above this trigger the extra-guest fee.">
          <input
            type="number"
            min={1}
            max={50}
            value={values.baseGuestCount}
            onChange={(e) => update("baseGuestCount", Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="Bedrooms">
          <input
            type="number"
            min={0}
            value={values.bedrooms}
            onChange={(e) => update("bedrooms", Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="Beds">
          <input
            type="number"
            min={0}
            value={values.beds}
            onChange={(e) => update("beds", Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="Bathrooms" help="Fractional values allowed — 1.5 etc.">
          <input
            type="number"
            min={0}
            step={0.5}
            value={values.bathrooms}
            onChange={(e) => update("bathrooms", e.target.value)}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="Address & location">
        <Field label="Full address" help="Only shown to guests with confirmed bookings." span={2}>
          <input
            type="text"
            value={values.addressFull}
            onChange={(e) => update("addressFull", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Approximate location" help="Shown publicly on the property page." span={2}>
          <input
            type="text"
            value={values.addressApprox}
            onChange={(e) => update("addressApprox", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Latitude">
          <input
            type="number"
            step="any"
            min={-90}
            max={90}
            value={values.latitude}
            onChange={(e) => update("latitude", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Longitude">
          <input
            type="number"
            step="any"
            min={-180}
            max={180}
            value={values.longitude}
            onChange={(e) => update("longitude", e.target.value)}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="Stay & policies">
        <Field label="Check-in time" help="e.g. 16:00">
          <input
            type="time"
            value={values.checkInTime}
            onChange={(e) => update("checkInTime", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Check-out time" help="e.g. 10:00">
          <input
            type="time"
            value={values.checkOutTime}
            onChange={(e) => update("checkOutTime", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Minimum stay (nights)">
          <input
            type="number"
            min={1}
            value={values.minStayDefault}
            onChange={(e) => update("minStayDefault", Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="Maximum stay (nights)" help="Leave blank for no max.">
          <input
            type="number"
            min={1}
            value={values.maxStay}
            onChange={(e) => update("maxStay", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Cancellation policy label">
          <select
            value={values.cancellationPolicy}
            onChange={(e) => update("cancellationPolicy", e.target.value)}
            className={inputClass}
          >
            <option value="flexible">Flexible</option>
            <option value="moderate">Moderate</option>
            <option value="strict">Strict</option>
          </select>
        </Field>
        <Field label="Booking mode" help="Instant = pay immediately; Request = guest requests and waits for host approval.">
          <select
            value={values.instantBookingEnabled ? "instant" : "request"}
            onChange={(e) => update("instantBookingEnabled", e.target.value === "instant")}
            className={inputClass}
          >
            <option value="instant">Instant book</option>
            <option value="request">Request to book</option>
          </select>
        </Field>
        <Field label="House rules" span={2}>
          <textarea
            value={values.houseRules}
            onChange={(e) => update("houseRules", e.target.value)}
            rows={4}
            className={inputClass}
          />
        </Field>
      </Section>

      <RefundTiersEditor
        tiers={values.cancellationTiers}
        onChange={(next) => update("cancellationTiers", next)}
      />

      <Section title="Pricing">
        <Field label="Base nightly rate">
          <input
            type="number"
            min={0}
            step="0.01"
            value={values.baseNightlyRate}
            onChange={(e) => update("baseNightlyRate", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Cleaning fee">
          <input
            type="number"
            min={0}
            step="0.01"
            value={values.cleaningFee}
            onChange={(e) => update("cleaningFee", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Extra guest fee / night" help="Applied per guest above the base count.">
          <input
            type="number"
            min={0}
            step="0.01"
            value={values.extraGuestFee}
            onChange={(e) => update("extraGuestFee", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Currency" help="ISO code, e.g. GBP, EUR, USD.">
          <input
            type="text"
            maxLength={3}
            value={values.currency}
            onChange={(e) => update("currency", e.target.value.toUpperCase())}
            className={inputClass}
          />
        </Field>
      </Section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Floats at the bottom of the viewport so the host can save
          changes without scrolling back from the photo manager. The
          parent page adds bottom padding to stop content disappearing
          behind it. */}
      <div className="pointer-events-none fixed bottom-4 left-0 right-0 z-30 px-6">
        <div className="pointer-events-auto mx-auto flex max-w-4xl items-center justify-end gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-lg">
          {savedAt && (
            <span className="text-xs text-emerald-700">
              Saved {savedAt.toLocaleTimeString("en-GB")}
            </span>
          )}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function RefundTiersEditor({
  tiers,
  onChange,
}: {
  tiers: RefundTierRow[];
  onChange: (next: RefundTierRow[]) => void;
}) {
  // Tiers render sorted by minDays descending so the admin reads them
  // like "14 days: 100%, 7 days: 50%" — the order refundRules actually
  // evaluate in. Edits mutate by index in the sorted view.
  const sorted = sortTiers(tiers);

  function updateRow(index: number, patch: Partial<RefundTierRow>) {
    const next = sorted.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  }
  function removeRow(index: number) {
    onChange(sorted.filter((_, i) => i !== index));
  }
  function addRow() {
    onChange([...sorted, { minDays: 0, percent: 0 }]);
  }
  function applyPreset(policy: keyof typeof PRESET_TIERS) {
    onChange(PRESET_TIERS[policy].map((t) => ({ ...t })));
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Cancellation refund tiers</h2>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-neutral-500">Preset:</span>
          <button
            type="button"
            onClick={() => applyPreset("flexible")}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 font-medium hover:bg-neutral-50"
          >
            Flexible
          </button>
          <button
            type="button"
            onClick={() => applyPreset("moderate")}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 font-medium hover:bg-neutral-50"
          >
            Moderate
          </button>
          <button
            type="button"
            onClick={() => applyPreset("strict")}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 font-medium hover:bg-neutral-50"
          >
            Strict
          </button>
        </div>
      </div>
      <p className="mb-4 text-xs text-neutral-500">
        The first tier whose notice period is met wins — so list generous
        tiers first (more days). Below the last tier, no refund is given.
        Changes here only affect <em>new</em> bookings — existing bookings
        keep the tiers they were made under.
      </p>

      {sorted.length === 0 ? (
        <p className="rounded-md border border-dashed border-neutral-300 p-4 text-center text-sm text-neutral-500">
          No refund tiers — every cancellation is non-refundable. Add a
          row below or apply a preset.
        </p>
      ) : (
        <ul className="space-y-2">
          <li className="flex items-center gap-3 px-2 text-xs uppercase tracking-wide text-neutral-500">
            <span className="w-32">Notice (days)</span>
            <span className="w-32">Refund (%)</span>
            <span className="flex-1">Effect</span>
            <span className="w-20" />
          </li>
          {sorted.map((tier, i) => (
            <li key={i} className="flex items-center gap-3 rounded-md border border-neutral-200 p-2">
              <input
                type="number"
                min={0}
                max={365}
                value={tier.minDays}
                onChange={(e) => updateRow(i, { minDays: Number(e.target.value) })}
                className="w-32 rounded-md border border-neutral-300 px-2 py-1 text-sm"
              />
              <input
                type="number"
                min={0}
                max={100}
                value={tier.percent}
                onChange={(e) => updateRow(i, { percent: Number(e.target.value) })}
                className="w-32 rounded-md border border-neutral-300 px-2 py-1 text-sm"
              />
              <span className="flex-1 text-sm text-neutral-600">
                {tier.percent}% refund for cancellations with at least {tier.minDays}{" "}
                {tier.minDays === 1 ? "day" : "days"} notice
              </span>
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="w-20 rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-red-600 hover:bg-neutral-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <button
          type="button"
          onClick={addRow}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
        >
          + Add tier
        </button>
      </div>
    </section>
  );
}
