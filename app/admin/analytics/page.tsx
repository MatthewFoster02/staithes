import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { todayUTC } from "@/lib/availability/dates";

export const metadata: Metadata = {
  title: "Admin · Analytics",
};

const RANGE_FILTERS = [
  { value: "3m", label: "Last 3 months", months: 3 },
  { value: "6m", label: "Last 6 months", months: 6 },
  { value: "12m", label: "Last 12 months", months: 12 },
] as const;

type RangeKey = (typeof RANGE_FILTERS)[number]["value"];

const QuerySchema = z.object({
  range: z.enum(["3m", "6m", "12m"]).default("12m"),
});

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface MonthBucket {
  label: string;
  start: Date;
  end: Date;
}

// Returns N months ending with the current month, oldest first.
function lastNMonths(today: Date, months: number): MonthBucket[] {
  const out: MonthBucket[] = [];
  const base = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    out.push({
      label: start.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }),
      start,
      end,
    });
  }
  return out;
}

function diffDays(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

// Inclusive count of nights in a month that overlap with [checkIn, checkOut).
// Used for occupancy: a stay 30 Apr → 3 May contributes 1 night to April
// and 3 to May.
function nightsInMonth(checkIn: Date, checkOut: Date, monthStart: Date, monthEnd: Date): number {
  const overlapStart = checkIn > monthStart ? checkIn : monthStart;
  const overlapEnd = checkOut < monthEnd ? checkOut : monthEnd;
  return diffDays(overlapStart, overlapEnd);
}

function pct(numer: number, denom: number): number {
  if (denom <= 0) return 0;
  return Math.round((numer / denom) * 1000) / 10;
}

export default async function AdminAnalyticsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  const filters = QuerySchema.parse(flat);
  const rangeMonths = RANGE_FILTERS.find((r) => r.value === filters.range)!.months;

  const property = await prisma.property.findFirst({ select: { id: true } });
  if (!property) {
    return (
      <article className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-neutral-600">No property configured.</p>
      </article>
    );
  }

  const today = todayUTC();
  const buckets = lastNMonths(today, rangeMonths);
  const windowStart = buckets[0].start;
  const windowEnd = buckets[buckets.length - 1].end;

  const [allInWindow, repeatRows] = await Promise.all([
    // All bookings whose stay overlaps the window. We'll filter by
    // status in JS so the same fetch drives several metrics.
    prisma.booking.findMany({
      where: {
        propertyId: property.id,
        OR: [
          { checkIn: { gte: windowStart, lt: windowEnd } },
          { checkOut: { gt: windowStart, lte: windowEnd } },
          {
            AND: [
              { checkIn: { lt: windowStart } },
              { checkOut: { gt: windowEnd } },
            ],
          },
        ],
      },
      select: {
        id: true,
        status: true,
        checkIn: true,
        checkOut: true,
        createdAt: true,
        guestId: true,
        guest: { select: { country: true } },
      },
    }),
    // Repeat-guest rate is computed across ALL bookings, not just the
    // window — a guest who first stayed two years ago and re-booked
    // this month is a repeat guest, even if year 1 falls outside the
    // current view.
    prisma.booking.groupBy({
      by: ["guestId"],
      where: { propertyId: property.id, status: { in: ["confirmed", "completed"] } },
      _count: { _all: true },
    }),
  ]);

  // Real bookings = anything that wasn't cancelled or no-show. Used
  // as the denominator for cancellation rate and the source for
  // length-of-stay / lead-time / occupancy.
  const realBookings = allInWindow.filter(
    (b) => b.status === "confirmed" || b.status === "completed",
  );
  const cancelled = allInWindow.filter((b) => b.status === "cancelled");
  const totalForRate = realBookings.length + cancelled.length;
  const cancellationRate = pct(cancelled.length, totalForRate);

  // Average length of stay across confirmed/completed bookings.
  let totalNights = 0;
  for (const b of realBookings) totalNights += diffDays(b.checkIn, b.checkOut);
  const avgLengthOfStay = realBookings.length > 0 ? totalNights / realBookings.length : 0;

  // Average lead time = days between createdAt and checkIn.
  let totalLead = 0;
  for (const b of realBookings) totalLead += diffDays(b.createdAt, b.checkIn);
  const avgLeadTime = realBookings.length > 0 ? totalLead / realBookings.length : 0;

  // Repeat guest rate = guests with 2+ bookings / total guests booked
  const guestsWithBookings = repeatRows.length;
  const repeatGuests = repeatRows.filter((r) => r._count._all >= 2).length;
  const repeatGuestRate = pct(repeatGuests, guestsWithBookings);

  // Occupancy by month: booked-nights / available-nights. Available
  // = days in the month, capped at the past portion only when the
  // month is in progress (don't count future days as available).
  const occupancy = buckets.map((bucket) => {
    let booked = 0;
    for (const b of realBookings) {
      booked += nightsInMonth(b.checkIn, b.checkOut, bucket.start, bucket.end);
    }
    const monthEndCapped = bucket.end > today ? today : bucket.end;
    const available = Math.max(0, diffDays(bucket.start, monthEndCapped));
    return {
      label: bucket.label,
      booked,
      available,
      pct: available > 0 ? Math.round((booked / available) * 100) : 0,
    };
  });
  const overallOccupancy = (() => {
    const sumBooked = occupancy.reduce((a, m) => a + m.booked, 0);
    const sumAvail = occupancy.reduce((a, m) => a + m.available, 0);
    return pct(sumBooked, sumAvail);
  })();

  // Top source countries — group confirmed/completed bookings by
  // guest country. Bookings without a country fall into "Unknown".
  const countryCounts = new Map<string, number>();
  for (const b of realBookings) {
    const key = (b.guest.country ?? "").trim() || "Unknown";
    countryCounts.set(key, (countryCounts.get(key) ?? 0) + 1);
  }
  const topCountries = Array.from(countryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const totalCountryBookings = realBookings.length;

  // Bookings-per-month for the chart legend.
  const bookingsByMonth = buckets.map((bucket) => {
    const count = realBookings.filter(
      (b) => b.createdAt >= bucket.start && b.createdAt < bucket.end,
    ).length;
    return { label: bucket.label, count };
  });

  return (
    <article className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Booking analytics</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Operational metrics for {windowLabel(filters.range)}. Cancellation
          and lead-time exclude pending bookings.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Range
        </span>
        {RANGE_FILTERS.map((r) => (
          <Link
            key={r.value}
            href={r.value === "12m" ? "/admin/analytics" : `/admin/analytics?range=${r.value}`}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filters.range === r.value
                ? "bg-neutral-900 text-white"
                : "bg-white text-neutral-700 ring-1 ring-inset ring-neutral-300 hover:bg-neutral-100"
            }`}
          >
            {r.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Occupancy" value={`${overallOccupancy}%`} subtitle={`${rangeMonths}-month average`} />
        <Card
          label="Avg length of stay"
          value={avgLengthOfStay.toFixed(1)}
          subtitle="nights per booking"
        />
        <Card
          label="Avg lead time"
          value={avgLeadTime.toFixed(0)}
          subtitle="days between booking and check-in"
        />
        <Card
          label="Cancellation rate"
          value={`${cancellationRate}%`}
          subtitle={`${cancelled.length} of ${totalForRate} bookings`}
        />
      </div>

      <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5">
        <header className="mb-4 flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Monthly occupancy</h2>
          <p className="text-xs text-neutral-500">Booked nights / available nights</p>
        </header>
        <OccupancyChart data={occupancy} />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-neutral-200 bg-white p-5">
          <header className="mb-4">
            <h2 className="text-base font-semibold">Top source countries</h2>
            <p className="text-xs text-neutral-500">
              Where confirmed guests booked from. Unknown = guest hasn&rsquo;t
              filled in their profile country.
            </p>
          </header>
          {topCountries.length === 0 ? (
            <p className="text-sm text-neutral-500">No data yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {topCountries.map(([country, count]) => (
                <li key={country} className="flex items-center justify-between">
                  <span className="text-neutral-800">{country}</span>
                  <span className="text-neutral-500">
                    {count} ({pct(count, totalCountryBookings).toFixed(1)}%)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5">
          <header className="mb-4">
            <h2 className="text-base font-semibold">Repeat guests</h2>
            <p className="text-xs text-neutral-500">
              Across the property&rsquo;s lifetime — not just the selected
              window.
            </p>
          </header>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <Stat label="Total guests" value={String(guestsWithBookings)} />
            <Stat
              label="Returning guests"
              value={String(repeatGuests)}
              subtitle={`${repeatGuestRate}%`}
            />
          </dl>
        </section>
      </div>

      <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5">
        <header className="mb-4">
          <h2 className="text-base font-semibold">Bookings created per month</h2>
          <p className="text-xs text-neutral-500">
            Confirmed and completed bookings, by the month the booking was made.
          </p>
        </header>
        <table className="w-full text-sm">
          <thead className="text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="py-2">Month</th>
              <th className="py-2 text-right">Bookings</th>
              <th className="py-2 text-right">Booked nights</th>
              <th className="py-2 text-right">Occupancy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {bookingsByMonth.map((row, i) => (
              <tr key={row.label}>
                <td className="py-2">{row.label}</td>
                <td className="py-2 text-right tabular-nums">{row.count}</td>
                <td className="py-2 text-right tabular-nums">{occupancy[i].booked}</td>
                <td className="py-2 text-right tabular-nums">{occupancy[i].pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </article>
  );
}

function windowLabel(range: RangeKey): string {
  switch (range) {
    case "3m":
      return "the last 3 months";
    case "6m":
      return "the last 6 months";
    case "12m":
    default:
      return "the last 12 months";
  }
}

function Card({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-neutral-900">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-neutral-500">{subtitle}</p>}
    </div>
  );
}

function Stat({ label, value, subtitle }: { label: string; value: string; subtitle?: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-neutral-900 tabular-nums">{value}</dd>
      {subtitle && <dd className="text-xs text-neutral-500">{subtitle}</dd>}
    </div>
  );
}

// Bar chart with hover tooltips. Same flex-col + justify-end pattern
// as the finance chart so each bar's height is honoured by the parent
// row regardless of value.
function OccupancyChart({
  data,
}: {
  data: { label: string; booked: number; available: number; pct: number }[];
}) {
  return (
    <div className="flex h-56 items-end gap-2">
      {data.map((m) => (
        <div key={m.label} className="group relative flex h-full flex-1 flex-col justify-end">
          <div
            className="rounded-t-md bg-emerald-500 transition group-hover:bg-emerald-600"
            style={{ height: `${m.pct}%` }}
            aria-label={`${m.label}: ${m.pct}% occupancy`}
          />
          <p className="mt-2 truncate text-center text-[10px] text-neutral-500">{m.label}</p>
          <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 rounded-md bg-neutral-900 px-2 py-1 text-xs text-white shadow-lg group-hover:block">
            {m.pct}% · {m.booked}/{m.available} nights
          </div>
        </div>
      ))}
    </div>
  );
}
