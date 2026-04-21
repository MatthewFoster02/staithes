import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { addDays, todayUTC } from "@/lib/availability/dates";
import { BookingStatusBadge } from "@/components/booking/status-badge";

export const metadata: Metadata = {
  title: "Admin · Dashboard",
};

const { Decimal } = Prisma;
type Decimal = Prisma.Decimal;

const CURRENCY_SYMBOLS: Record<string, string> = { GBP: "£", EUR: "€", USD: "$" };

function formatMoney(value: Decimal | string | number, currency: string): string {
  const num = typeof value === "object" ? value.toNumber() : Number(value);
  return `${CURRENCY_SYMBOLS[currency] ?? `${currency} `}${num.toFixed(0)}`;
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

// Returns the number of nights of `booking` that fall within
// [monthStart, monthEnd). Booking dates are half-open.
function nightsInMonth(
  booking: { checkIn: Date; checkOut: Date },
  monthStart: Date,
  monthEnd: Date,
): number {
  const start = booking.checkIn > monthStart ? booking.checkIn : monthStart;
  const end = booking.checkOut < monthEnd ? booking.checkOut : monthEnd;
  if (end <= start) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

export default async function AdminDashboardPage() {
  const property = await prisma.property.findFirst({ select: { id: true, currency: true, name: true } });
  if (!property) {
    return (
      <article className="mx-auto max-w-7xl px-6 py-10">
        <p className="text-sm text-neutral-600">No property configured.</p>
      </article>
    );
  }

  const today = todayUTC();
  const tomorrow = addDays(today, 1);
  const next30 = addDays(today, 30);
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
  const daysInMonth = Math.round((monthEnd.getTime() - monthStart.getTime()) / 86400000);

  const [
    todaysArrivals,
    todaysCheckouts,
    upcomingThirtyDayCount,
    upcomingThirtyDayAgg,
    monthBookings,
    nextFiveUpcoming,
    recentFive,
  ] = await Promise.all([
    prisma.booking.findMany({
      where: {
        propertyId: property.id,
        status: { in: ["confirmed", "pending"] },
        checkIn: { gte: today, lt: tomorrow },
      },
      include: { guest: { select: { firstName: true, lastName: true } } },
      orderBy: { checkIn: "asc" },
    }),
    prisma.booking.findMany({
      where: {
        propertyId: property.id,
        status: "confirmed",
        checkOut: { gte: today, lt: tomorrow },
      },
      include: { guest: { select: { firstName: true, lastName: true } } },
      orderBy: { checkOut: "asc" },
    }),
    prisma.booking.count({
      where: {
        propertyId: property.id,
        status: "confirmed",
        checkIn: { gte: today, lt: next30 },
      },
    }),
    prisma.booking.aggregate({
      where: {
        propertyId: property.id,
        status: "confirmed",
        checkIn: { gte: today, lt: next30 },
      },
      _sum: { totalPrice: true },
    }),
    // For revenue + occupancy: every confirmed booking that touches
    // any part of the current month.
    prisma.booking.findMany({
      where: {
        propertyId: property.id,
        status: "confirmed",
        checkIn: { lt: monthEnd },
        checkOut: { gt: monthStart },
      },
      select: { checkIn: true, checkOut: true, totalPrice: true, currency: true },
    }),
    prisma.booking.findMany({
      where: {
        propertyId: property.id,
        status: "confirmed",
        checkIn: { gte: today },
      },
      include: { guest: { select: { firstName: true, lastName: true } } },
      orderBy: { checkIn: "asc" },
      take: 5,
    }),
    prisma.booking.findMany({
      where: { propertyId: property.id },
      include: { guest: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  // Sum revenue for stays whose check-in falls in the current month.
  // Note: this is "revenue from stays starting this month", not "money
  // received this month" — for the host overview the former is more
  // useful (they care about which stays they're earning from).
  let monthRevenue = new Decimal(0);
  let bookedNights = 0;
  for (const b of monthBookings) {
    if (b.checkIn >= monthStart && b.checkIn < monthEnd) {
      monthRevenue = monthRevenue.plus(new Decimal(b.totalPrice));
    }
    bookedNights += nightsInMonth(b, monthStart, monthEnd);
  }
  const occupancyPct = Math.round((bookedNights / daysInMonth) * 100);
  const upcomingRevenue = upcomingThirtyDayAgg._sum.totalPrice ?? new Decimal(0);

  return (
    <article className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {property.name} · {today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
        </p>
      </header>

      {/* Summary cards */}
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="Today's arrivals" value={String(todaysArrivals.length)}>
          {todaysArrivals.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-neutral-600">
              {todaysArrivals.map((b) => (
                <li key={b.id}>{b.guest.firstName} {b.guest.lastName}</li>
              ))}
            </ul>
          )}
        </SummaryCard>
        <SummaryCard label="Today's check-outs" value={String(todaysCheckouts.length)}>
          {todaysCheckouts.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-neutral-600">
              {todaysCheckouts.map((b) => (
                <li key={b.id}>{b.guest.firstName} {b.guest.lastName}</li>
              ))}
            </ul>
          )}
        </SummaryCard>
        <SummaryCard
          label="Next 30 days"
          value={String(upcomingThirtyDayCount)}
          subtitle={`${formatMoney(upcomingRevenue, property.currency)} booked`}
        />
        <SummaryCard
          label="This month's revenue"
          value={formatMoney(monthRevenue, property.currency)}
          subtitle="From stays starting this month"
        />
        <SummaryCard
          label="Occupancy this month"
          value={`${occupancyPct}%`}
          subtitle={`${bookedNights} of ${daysInMonth} nights`}
        />
      </div>

      {/* Two-column lists */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ListSection title="Upcoming bookings" empty="No upcoming bookings.">
          {nextFiveUpcoming.length > 0 &&
            nextFiveUpcoming.map((b) => (
              <ListRow
                key={b.id}
                href={`/admin/bookings/${b.id}`}
                primary={`${b.guest.firstName} ${b.guest.lastName}`}
                secondary={`${formatDateShort(b.checkIn)} → ${formatDateShort(b.checkOut)}`}
                meta={formatMoney(b.totalPrice, b.currency)}
                badge={
                  <BookingStatusBadge
                    status={b.status}
                    bookingType={b.bookingType}
                    approvedAt={b.approvedAt}
                  />
                }
              />
            ))}
        </ListSection>

        <ListSection title="Recent activity" empty="No bookings yet.">
          {recentFive.length > 0 &&
            recentFive.map((b) => (
              <ListRow
                key={b.id}
                href={`/admin/bookings/${b.id}`}
                primary={`${b.guest.firstName} ${b.guest.lastName}`}
                secondary={`Created ${formatDateShort(b.createdAt)} · ${formatDateShort(b.checkIn)} → ${formatDateShort(b.checkOut)}`}
                meta={formatMoney(b.totalPrice, b.currency)}
                badge={
                  <BookingStatusBadge
                    status={b.status}
                    bookingType={b.bookingType}
                    approvedAt={b.approvedAt}
                  />
                }
              />
            ))}
        </ListSection>
      </div>
    </article>
  );
}

function SummaryCard({
  label,
  value,
  subtitle,
  children,
}: {
  label: string;
  value: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-neutral-500">{subtitle}</p>}
      {children}
    </div>
  );
}

function ListSection({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children?: React.ReactNode;
}) {
  const hasChildren = !!children && (Array.isArray(children) ? children.some(Boolean) : true);
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white">
      <header className="border-b border-neutral-200 px-5 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{title}</h2>
      </header>
      {hasChildren ? (
        <ul className="divide-y divide-neutral-100">{children}</ul>
      ) : (
        <p className="px-5 py-8 text-center text-sm text-neutral-500">{empty}</p>
      )}
    </section>
  );
}

function ListRow({
  href,
  primary,
  secondary,
  meta,
  badge,
}: {
  href: string;
  primary: string;
  secondary: string;
  meta: string;
  badge?: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-neutral-50"
      >
        <div className="min-w-0">
          <p className="font-medium text-neutral-900">{primary}</p>
          <p className="text-xs text-neutral-500">{secondary}</p>
        </div>
        <div className="flex items-center gap-3">
          {badge}
          <span className="text-sm font-medium text-neutral-900">{meta}</span>
        </div>
      </Link>
    </li>
  );
}
