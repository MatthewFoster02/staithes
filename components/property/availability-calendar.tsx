"use client";

import * as React from "react";
import type { DateRange, Matcher } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  differenceInDays,
  formatISODate,
  todayUTC,
} from "@/lib/availability/dates";

interface AvailabilityCalendarProps {
  baseNightlyRate: string;
  currency: string;
  minStay: number;
  maxStay: number | null;
  maxGuests: number;
}

interface PriceBreakdown {
  numNights: number;
  subtotalAccommodation: string;
  cleaningFee: string;
  extraGuestFeeTotal: string;
  total: string;
  currency: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  EUR: "€",
  USD: "$",
};

function symbolFor(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? `${currency} `;
}

function formatMoney(value: string, currency: string): string {
  const num = Number(value);
  return `${symbolFor(currency)}${num.toFixed(0)}`;
}

export function AvailabilityCalendar({
  baseNightlyRate,
  currency,
  minStay,
  maxStay,
  maxGuests,
}: AvailabilityCalendarProps) {
  const [blockedDays, setBlockedDays] = React.useState<Set<string>>(new Set());
  const [loadingBlocked, setLoadingBlocked] = React.useState(true);
  const [range, setRange] = React.useState<DateRange | undefined>(undefined);
  const [adults, setAdults] = React.useState(2);
  const [children, setChildren] = React.useState(0);
  const [breakdown, setBreakdown] = React.useState<PriceBreakdown | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch the year-long blocked-day list once on mount.
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/availability/blocked")
      .then((r) => r.json())
      .then((data: { blocked: string[] }) => {
        if (cancelled) return;
        setBlockedDays(new Set(data.blocked));
      })
      .catch(() => {
        if (cancelled) return;
        setBlockedDays(new Set());
      })
      .finally(() => {
        if (!cancelled) setLoadingBlocked(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Whenever the range changes (and is complete and valid), fetch the
  // price breakdown. We rely on /api/availability for hard validation
  // before allowing checkout, but the live price preview is fast
  // enough to do on every change.
  React.useEffect(() => {
    if (!range?.from || !range?.to) {
      setBreakdown(null);
      setError(null);
      return;
    }
    const numNights = differenceInDays(range.to, range.from);
    if (numNights < minStay) {
      setBreakdown(null);
      setError(`Minimum stay is ${minStay} nights.`);
      return;
    }
    if (maxStay !== null && numNights > maxStay) {
      setBreakdown(null);
      setError(`Maximum stay is ${maxStay} nights.`);
      return;
    }

    const params = new URLSearchParams({
      checkIn: formatISODate(range.from),
      checkOut: formatISODate(range.to),
      adults: String(adults),
      children: String(children),
    });

    let cancelled = false;
    setError(null);
    fetch(`/api/pricing?${params.toString()}`)
      .then(async (r) => {
        const data = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          setBreakdown(null);
          setError(data.message ?? "Could not calculate price.");
          return;
        }
        setBreakdown(data);
      })
      .catch(() => {
        if (cancelled) return;
        setBreakdown(null);
        setError("Could not calculate price.");
      });
    return () => {
      cancelled = true;
    };
  }, [range, adults, children, minStay, maxStay]);

  const today = todayUTC();
  const blockedMatcher: Matcher = (day: Date) => blockedDays.has(formatISODate(day));
  // Disable: past days, blocked days. react-day-picker handles the
  // "can't end on a blocked day" case via disabled directly.
  const disabled: Matcher[] = [{ before: today }, blockedMatcher];

  const totalGuests = adults + children;
  const guestsLabel = totalGuests === 1 ? "1 guest" : `${totalGuests} guests`;

  return (
    <div className="rounded-2xl border border-neutral-200 p-6 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <p className="text-2xl font-semibold">
          {formatMoney(baseNightlyRate, currency)}{" "}
          <span className="text-base font-normal text-neutral-500">/ night</span>
        </p>
        {breakdown && (
          <p className="text-sm text-neutral-600">
            {breakdown.numNights} {breakdown.numNights === 1 ? "night" : "nights"}
          </p>
        )}
      </div>

      {loadingBlocked ? (
        <div className="flex h-64 items-center justify-center text-sm text-neutral-500">
          Loading availability…
        </div>
      ) : (
        <Calendar
          mode="range"
          selected={range}
          onSelect={setRange}
          numberOfMonths={1}
          disabled={disabled}
          excludeDisabled
          startMonth={today}
          className="mx-auto"
          classNames={{
            // Today: subtle ring instead of a fill, so it doesn't
            // visually merge with range_middle/range_end (which both
            // use bg-muted in the shadcn defaults).
            today:
              "relative bg-transparent text-foreground ring-1 ring-inset ring-neutral-300 rounded-(--cell-radius) data-[selected=true]:ring-0",
            // Tailwind v4 dropped the legacy cursor:pointer button
            // default. Target the child Button (not the cell) so the
            // pointer follows pointer-events: enabled buttons get the
            // pointer, disabled buttons block events and the cell's
            // default cursor shows through.
            day: "[&>button]:cursor-pointer",
          }}
        />
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-neutral-600">Adults</span>
          <select
            value={adults}
            onChange={(e) => setAdults(Number(e.target.value))}
            className="rounded-md border border-neutral-300 px-2 py-1.5"
          >
            {Array.from({ length: maxGuests }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-neutral-600">Children</span>
          <select
            value={children}
            onChange={(e) => setChildren(Number(e.target.value))}
            className="rounded-md border border-neutral-300 px-2 py-1.5"
          >
            {Array.from({ length: maxGuests - adults + 1 }, (_, i) => i).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}

      {breakdown && !error && (
        <dl className="mt-4 space-y-1 text-sm text-neutral-700">
          <div className="flex justify-between">
            <dt>
              {formatMoney(baseNightlyRate, currency)} × {breakdown.numNights} nights
            </dt>
            <dd>{formatMoney(breakdown.subtotalAccommodation, currency)}</dd>
          </div>
          {Number(breakdown.extraGuestFeeTotal) > 0 && (
            <div className="flex justify-between">
              <dt>Extra guests</dt>
              <dd>{formatMoney(breakdown.extraGuestFeeTotal, currency)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>Cleaning fee</dt>
            <dd>{formatMoney(breakdown.cleaningFee, currency)}</dd>
          </div>
          <div className="mt-2 flex justify-between border-t border-neutral-200 pt-2 text-base font-semibold text-neutral-900">
            <dt>Total ({guestsLabel})</dt>
            <dd>{formatMoney(breakdown.total, currency)}</dd>
          </div>
        </dl>
      )}

      <Button
        className="mt-4 w-full"
        disabled={!breakdown || !!error}
      >
        {breakdown ? "Reserve" : "Select dates"}
      </Button>

      <p className="mt-3 text-center text-xs text-neutral-500">
        Booking flow lands in Phase 2 — Stripe checkout coming next.
      </p>
    </div>
  );
}
