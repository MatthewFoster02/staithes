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

  // Maximum revenue across the months — drives the bar heights.
  const maxMonthRevenue = byMonth.reduce(
    (max, m) => (m.revenue.gt(max) ? m.revenue : max),
    new Decimal(0),
  );

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

      {/* Bar chart */}
      <section className="mb-10 rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-4 text-base font-semibold">Revenue by month</h2>
        <div className="grid grid-cols-12 items-end gap-2 h-60">
          {byMonth.map((m) => {
            const height = maxMonthRevenue.gt(0)
              ? Math.round((m.revenue.toNumber() / maxMonthRevenue.toNumber()) * 100)
              : 0;
            return (
              <div key={`${m.year}-${m.month}`} className="flex flex-col items-center gap-1">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t bg-emerald-500 transition hover:bg-emerald-600"
                    style={{ height: `${height}%` }}
                    title={`${m.label}: ${money(m.revenue, property.currency)} (${m.bookings} booking${m.bookings === 1 ? "" : "s"})`}
                  />
                </div>
                <span className="text-[10px] text-neutral-500">{m.label}</span>
              </div>
            );
          })}
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
