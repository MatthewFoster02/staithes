import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { differenceInDays, formatISODate, todayUTC } from "@/lib/availability/dates";
import { BookingStatusBadge } from "@/components/booking/status-badge";
import type { BookingStatus, Prisma } from "@/lib/generated/prisma/client";

export const metadata: Metadata = {
  title: "Admin · Bookings",
};

const STATUS_FILTERS: { value: BookingStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No-show" },
];

const RANGE_FILTERS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "all", label: "All time" },
] as const;

const QuerySchema = z.object({
  status: z
    .enum(["all", "pending", "confirmed", "cancelled", "completed", "no_show"])
    .default("all"),
  range: z.enum(["upcoming", "past", "all"]).default("upcoming"),
  q: z.string().optional(),
});

const CURRENCY_SYMBOLS: Record<string, string> = { GBP: "£", EUR: "€", USD: "$" };

function formatMoney(value: string, currency: string): string {
  return `${CURRENCY_SYMBOLS[currency] ?? `${currency} `}${Number(value).toFixed(0)}`;
}

function formatDateShort(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminBookingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  const filters = QuerySchema.parse(flat);

  const where: Prisma.BookingWhereInput = {};
  if (filters.status !== "all") {
    where.status = filters.status;
  }
  const today = todayUTC();
  if (filters.range === "upcoming") {
    where.checkOut = { gte: today };
  } else if (filters.range === "past") {
    where.checkOut = { lt: today };
  }
  if (filters.q && filters.q.trim()) {
    const q = filters.q.trim();
    where.guest = {
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    };
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      guest: { select: { firstName: true, lastName: true, email: true } },
      property: { select: { name: true } },
    },
    orderBy: [{ checkIn: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  return (
    <article className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Bookings</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {bookings.length} {bookings.length === 1 ? "booking" : "bookings"} matching your filters.
        </p>
      </header>

      {/* Filters */}
      <div className="mb-6 space-y-4">
        <FilterRow label="Status">
          {STATUS_FILTERS.map((s) => (
            <FilterChip
              key={s.value}
              active={filters.status === s.value}
              href={buildUrl(filters, { status: s.value })}
            >
              {s.label}
            </FilterChip>
          ))}
        </FilterRow>
        <FilterRow label="When">
          {RANGE_FILTERS.map((r) => (
            <FilterChip
              key={r.value}
              active={filters.range === r.value}
              href={buildUrl(filters, { range: r.value })}
            >
              {r.label}
            </FilterChip>
          ))}
        </FilterRow>
        <form method="get" className="flex max-w-md gap-2">
          {filters.status !== "all" && <input type="hidden" name="status" value={filters.status} />}
          {filters.range !== "upcoming" && <input type="hidden" name="range" value={filters.range} />}
          <input
            type="text"
            name="q"
            placeholder="Search by guest name or email…"
            defaultValue={filters.q ?? ""}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Search
          </button>
        </form>
      </div>

      {/* Table */}
      {bookings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
          No bookings match these filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Guest</th>
                <th className="px-4 py-3">Stay</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Created</th>
                <th className="px-4 py-3 sr-only">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {bookings.map((b) => {
                const checkInISO = formatISODate(b.checkIn);
                const checkOutISO = formatISODate(b.checkOut);
                const numNights = differenceInDays(b.checkOut, b.checkIn);
                return (
                  <tr key={b.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-900">
                        {b.guest.firstName} {b.guest.lastName}
                      </p>
                      <p className="text-xs text-neutral-500">{b.guest.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-neutral-900">
                        {formatDateShort(checkInISO)} → {formatDateShort(checkOutISO)}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {numNights} {numNights === 1 ? "night" : "nights"} ·{" "}
                        {b.numGuestsAdults + b.numGuestsChildren} guests
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <BookingStatusBadge status={b.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-neutral-900">
                      {formatMoney(b.totalPrice.toFixed(2), b.currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-neutral-500">
                      {formatDateShort(formatISODate(b.createdAt))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/bookings/${b.id}`}
                        className="text-sm font-medium text-neutral-900 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</span>
      {children}
    </div>
  );
}

function FilterChip({
  active,
  href,
  children,
}: {
  active: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active
          ? "bg-neutral-900 text-white"
          : "bg-white text-neutral-700 ring-1 ring-inset ring-neutral-300 hover:bg-neutral-100"
      }`}
    >
      {children}
    </Link>
  );
}

function buildUrl(
  current: { status: string; range: string; q?: string },
  override: Partial<{ status: string; range: string; q: string }>,
): string {
  const next = { ...current, ...override };
  const params = new URLSearchParams();
  if (next.status && next.status !== "all") params.set("status", next.status);
  if (next.range && next.range !== "upcoming") params.set("range", next.range);
  if (next.q) params.set("q", next.q);
  const qs = params.toString();
  return qs ? `/admin/bookings?${qs}` : "/admin/bookings";
}
