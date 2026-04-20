import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { todayUTC } from "@/lib/availability/dates";

export const metadata: Metadata = {
  title: "Admin · Finance",
};

const { Decimal } = Prisma;
type Decimal = Prisma.Decimal;

const CURRENCY_SYMBOLS: Record<string, string> = { GBP: "£", EUR: "€", USD: "$" };
function symbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? `${currency} `;
}
function money(value: Decimal | number, currency: string): string {
  const n = typeof value === "object" ? value.toNumber() : value;
  return `${symbol(currency)}${n.toFixed(0)}`;
}

// Picks a "nice" Y-axis ceiling ~15% above the biggest bar plus a
// set of evenly spaced tick labels. The step is 1, 2, or 5 × the
// appropriate power of ten — the same convention most hand-drawn
// chart axes use. Returns a sensible default frame when every month
// is zero so the chart doesn't collapse to nothing.
function computeAxis(max: number): { ceiling: number; ticks: number[] } {
  if (max <= 0) {
    return { ceiling: 100, ticks: [0, 25, 50, 75, 100] };
  }
  const padded = max * 1.15;
  const magnitude = Math.pow(10, Math.floor(Math.log10(padded)));
  const normalized = padded / magnitude;
  let stepMultiplier: number;
  if (normalized <= 2) stepMultiplier = 0.5;
  else if (normalized <= 5) stepMultiplier = 1;
  else stepMultiplier = 2;
  const step = stepMultiplier * magnitude;
  const ceiling = Math.ceil(padded / step) * step;
  const numTicks = Math.round(ceiling / step);
  const ticks = Array.from({ length: numTicks + 1 }, (_, i) => i * step);
  return { ceiling, ticks };
}

// Returns the last 12 months (inclusive of current) as {year, month}
// tuples with their UTC boundaries.
function last12Months(today: Date) {
  const months: { label: string; year: number; month: number; start: Date; end: Date }[] = [];
  const base = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  for (let i = 11; i >= 0; i--) {
    const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    months.push({
      label: start.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }),
      year: start.getUTCFullYear(),
      month: start.getUTCMonth(),
      start,
      end,
    });
  }
  return months;
}

export default async function AdminFinancePage() {
  const property = await prisma.property.findFirst({ select: { id: true, currency: true } });
  if (!property) {
    return (
      <article className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-neutral-600">No property configured.</p>
      </article>
    );
  }

  const today = todayUTC();
  const months = last12Months(today);
  const yearStart = months[0].start;
  const yearEnd = months[months.length - 1].end;

  // Revenue metric: confirmed/completed bookings whose check-in falls
  // in the window. Matches the "this month's revenue" definition from
  // the Phase 3 dashboard — counts the stay, not the cash date.
  const [allBookings, allPayments, totalRefunds, pendingCount] = await Promise.all([
    prisma.booking.findMany({
      where: {
        propertyId: property.id,
        status: { in: ["confirmed", "completed"] },
        checkIn: { gte: yearStart, lt: yearEnd },
      },
      select: { checkIn: true, totalPrice: true, numGuestsAdults: true, numGuestsChildren: true },
    }),
    prisma.payment.findMany({
      where: { createdAt: { gte: yearStart, lt: yearEnd } },
      select: { createdAt: true, type: true, amount: true, status: true },
    }),
    prisma.payment.aggregate({
      where: {
        type: "refund",
        status: "completed",
      },
      _sum: { amount: true },
    }),
    prisma.booking.count({
      where: { propertyId: property.id, status: "pending" },
    }),
  ]);

  // Bucket bookings by month.
  const byMonth = months.map((m) => {
    const bookings = allBookings.filter(
      (b) => b.checkIn >= m.start && b.checkIn < m.end,
    );
    const revenue = bookings.reduce(
      (sum, b) => sum.plus(new Decimal(b.totalPrice)),
      new Decimal(0),
    );
    const payments = allPayments.filter(
      (p) => p.createdAt >= m.start && p.createdAt < m.end,
    );
    const refunds = payments
      .filter((p) => p.type === "refund" && p.status === "completed")
      .reduce((sum, p) => sum.plus(new Decimal(p.amount)), new Decimal(0));
    return {
      ...m,
      bookings: bookings.length,
      revenue,
      refunds,
    };
  });

  const totalRevenue = byMonth.reduce(
    (sum, m) => sum.plus(m.revenue),
    new Decimal(0),
  );
  const totalBookings = byMonth.reduce((sum, m) => sum + m.bookings, 0);
  const avgBookingValue =
    totalBookings > 0 ? totalRevenue.div(totalBookings) : new Decimal(0);
  const refundTotal = totalRefunds._sum.amount ?? new Decimal(0);

  // Y axis: ceiling is 15% above the biggest month rounded to a nice
  // number, tick labels sit at 0 and every step up to ceiling.
  const maxMonthRevenue = byMonth.reduce(
    (max, m) => (m.revenue.gt(max) ? m.revenue : max),
    new Decimal(0),
  );
  const axis = computeAxis(maxMonthRevenue.toNumber());

  return (
    <article className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Finance</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Revenue comes from stays starting in each month — not when the
          payment hit Stripe. Refunds are counted in the month the refund
          was processed.
        </p>
      </header>

      {/* Summary cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Revenue (last 12 months)"
          value={money(totalRevenue, property.currency)}
        />
        <SummaryCard
          label="Bookings (last 12 months)"
          value={String(totalBookings)}
        />
        <SummaryCard
          label="Avg booking value"
          value={money(avgBookingValue, property.currency)}
        />
        <SummaryCard
          label="Refunds (all time)"
          value={money(refundTotal, property.currency)}
          subtitle="across every booking"
        />
      </div>

      {/* Bar chart — Y axis on the left with tick labels, bars in a
          flex row, subtle horizontal gridlines aligned with ticks. */}
      <section className="mb-10 rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-4 text-base font-semibold">Revenue by month</h2>
        <div className="flex gap-3">
          {/* Y axis labels — rendered top-down so the highest tick is
              at the top of the chart. justify-between spreads them
              evenly to match the tick positions in the chart area. */}
          <div className="flex h-60 shrink-0 flex-col-reverse justify-between py-0 text-right text-[10px] text-neutral-500">
            {axis.ticks.map((t) => (
              <span key={t} className="leading-none">
                {money(t, property.currency)}
              </span>
            ))}
          </div>
          <div className="flex-1">
            <div className="relative h-60 border-b border-l border-neutral-200">
              {/* Horizontal gridlines at each non-zero tick. */}
              {axis.ticks.slice(1).map((t) => (
                <div
                  key={`grid-${t}`}
                  className="pointer-events-none absolute inset-x-0 border-t border-neutral-100"
                  style={{ bottom: `${(t / axis.ceiling) * 100}%` }}
                />
              ))}
              {/* Each column is h-full and flex-col-justify-end so the
                  bar grows upward from the bottom. Previously had
                  items-end on the parent which only aligned columns to
                  the bottom without stretching their height — so the
                  inner "X%" bar was X% of the column's content height
                  (~0), and every bar rendered at zero. */}
              <div className="relative flex h-full gap-2">
                {byMonth.map((m) => {
                  const heightPct = axis.ceiling > 0
                    ? (m.revenue.toNumber() / axis.ceiling) * 100
                    : 0;
                  return (
                    <div
                      key={`${m.year}-${m.month}`}
                      className="group relative flex h-full flex-1 flex-col justify-end"
                    >
                      <div
                        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-xs text-white shadow-lg group-hover:block"
                      >
                        <span className="block font-semibold">{m.label}</span>
                        <span className="block">
                          {money(m.revenue, property.currency)}
                          {m.refunds.gt(0) && (
                            <span className="ml-1 text-red-300">
                              − {money(m.refunds, property.currency)}
                            </span>
                          )}
                        </span>
                        <span className="block text-neutral-300">
                          {m.bookings} booking{m.bookings === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div
                        className="w-full rounded-t bg-emerald-500 transition group-hover:bg-emerald-600"
                        style={{
                          height: `${heightPct > 0 ? Math.max(heightPct, 1) : 0}%`,
                          minHeight: heightPct > 0 ? "4px" : undefined,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-1 flex gap-2">
              {byMonth.map((m) => (
                <span
                  key={`label-${m.year}-${m.month}`}
                  className="flex-1 text-center text-[10px] text-neutral-500"
                >
                  {m.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Monthly table */}
      <section className="rounded-2xl border border-neutral-200 bg-white">
        <header className="border-b border-neutral-200 px-5 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Month-by-month
          </h2>
        </header>
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3">Month</th>
              <th className="px-4 py-3 text-right">Bookings</th>
              <th className="px-4 py-3 text-right">Revenue</th>
              <th className="px-4 py-3 text-right">Refunds</th>
              <th className="px-4 py-3 text-right">Net</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {byMonth.map((m) => (
              <tr key={`${m.year}-${m.month}`}>
                <td className="px-4 py-3 font-medium text-neutral-900">{m.label}</td>
                <td className="px-4 py-3 text-right">{m.bookings}</td>
                <td className="px-4 py-3 text-right">{money(m.revenue, property.currency)}</td>
                <td className="px-4 py-3 text-right text-neutral-500">
                  {m.refunds.gt(0) ? `−${money(m.refunds, property.currency)}` : "—"}
                </td>
                <td className="px-4 py-3 text-right font-medium text-neutral-900">
                  {money(m.revenue.minus(m.refunds), property.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {pendingCount > 0 && (
        <p className="mt-6 text-center text-sm text-neutral-500">
          {pendingCount} booking{pendingCount === 1 ? " is" : "s are"} currently
          pending payment and not counted here.{" "}
          <Link href="/admin/bookings?status=pending" className="underline-offset-4 hover:underline">
            View them
          </Link>
          .
        </p>
      )}
    </article>
  );
}

function SummaryCard({
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
      <p className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-neutral-500">{subtitle}</p>}
    </div>
  );
}
