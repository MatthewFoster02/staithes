import type { Metadata } from "next";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { addDays, formatISODate } from "@/lib/availability/dates";
import { AdminCalendar, type CalendarDayEntry } from "@/components/admin/admin-calendar";

export const metadata: Metadata = {
  title: "Admin · Calendar",
};

const QuerySchema = z.object({
  // YYYY-MM (defaults to the current month)
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminCalendarPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  const filters = QuerySchema.parse(flat);

  // Resolve the visible month, defaulting to today's month in UTC.
  const now = new Date();
  let viewYear = now.getUTCFullYear();
  let viewMonth = now.getUTCMonth(); // 0-indexed
  if (filters.month) {
    const [y, m] = filters.month.split("-").map((x) => parseInt(x, 10));
    if (y && m) {
      viewYear = y;
      viewMonth = m - 1;
    }
  }

  // Fetch a window slightly larger than the month so spillover days
  // visible at the edges of the calendar grid (last week of the
  // previous month, first week of the next month) are also coloured.
  const windowStart = new Date(Date.UTC(viewYear, viewMonth, 1));
  const windowEnd = new Date(Date.UTC(viewYear, viewMonth + 1, 0)); // last day of month
  const fetchFrom = addDays(windowStart, -7);
  const fetchTo = addDays(windowEnd, 8); // exclusive

  const property = await prisma.property.findFirst({ select: { id: true, name: true } });
  if (!property) {
    return (
      <article className="mx-auto max-w-7xl px-6 py-10">
        <p className="text-sm text-neutral-600">No property configured.</p>
      </article>
    );
  }

  const [bookings, blocked] = await Promise.all([
    prisma.booking.findMany({
      where: {
        propertyId: property.id,
        status: { in: ["pending", "confirmed"] },
        checkIn: { lt: fetchTo },
        checkOut: { gt: fetchFrom },
      },
      include: { guest: { select: { firstName: true, lastName: true } } },
    }),
    prisma.blockedDate.findMany({
      where: {
        propertyId: property.id,
        dateStart: { lt: fetchTo },
        dateEnd: { gte: fetchFrom },
      },
    }),
  ]);

  // Build a flat day-keyed map of what's happening on each day. The
  // booking entries win if a blocked date overlaps a booking — bookings
  // are the "stronger" signal and clicking should jump to the booking.
  const days: Record<string, CalendarDayEntry> = {};

  for (const blockedRange of blocked) {
    for (
      let day = new Date(blockedRange.dateStart);
      day <= blockedRange.dateEnd;
      day = addDays(day, 1)
    ) {
      const key = formatISODate(day);
      days[key] = {
        type: "blocked",
        blockedDateId: blockedRange.id,
        reason: blockedRange.reason ?? null,
        rangeStart: formatISODate(blockedRange.dateStart),
        rangeEnd: formatISODate(blockedRange.dateEnd),
      };
    }
  }

  // Bookings overlay blocked dates so the host always lands on a
  // booking when clicking, even if a blocked range happens to overlap.
  for (const booking of bookings) {
    for (
      let day = new Date(booking.checkIn);
      day < booking.checkOut;
      day = addDays(day, 1)
    ) {
      const key = formatISODate(day);
      days[key] = {
        type: booking.status === "confirmed" ? "confirmed" : "pending",
        bookingId: booking.id,
        guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
      };
    }
  }

  return (
    <article className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Calendar</h1>
        <p className="mt-1 text-sm text-neutral-600">{property.name}</p>
      </header>
      <AdminCalendar
        viewYear={viewYear}
        viewMonth={viewMonth}
        days={days}
      />
    </article>
  );
}
