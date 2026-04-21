import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { differenceInDays, formatISODate, todayUTC } from "@/lib/availability/dates";
import { BookingCard } from "@/components/booking/booking-card";
import type { BookingStatus, BookingType } from "@/lib/generated/prisma/client";

export const metadata: Metadata = {
  title: "My bookings",
};

interface SectionedBookings {
  upcoming: BookingRow[];
  inProgress: BookingRow[];
  pastOrCompleted: BookingRow[];
  cancelled: BookingRow[];
  pending: BookingRow[];
}

interface BookingRow {
  id: string;
  propertyName: string;
  checkInISO: string;
  checkOutISO: string;
  numNights: number;
  totalPrice: string;
  currency: string;
  status: BookingStatus;
  bookingType: BookingType;
  approvedAt: Date | null;
}

export default async function DashboardPage() {
  // Proxy already gates this route, but keep the explicit check so
  // the page is safe in isolation and the type narrows for guest fetch.
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  const guest = await prisma.guest.findUnique({
    where: { id: user.id },
    select: { firstName: true },
  });

  const bookings = await prisma.booking.findMany({
    where: { guestId: user.id },
    include: { property: { select: { name: true } } },
    orderBy: { checkIn: "desc" },
  });

  const today = todayUTC();
  const sections: SectionedBookings = {
    upcoming: [],
    inProgress: [],
    pastOrCompleted: [],
    cancelled: [],
    pending: [],
  };

  for (const b of bookings) {
    const row: BookingRow = {
      id: b.id,
      propertyName: b.property.name,
      checkInISO: formatISODate(b.checkIn),
      checkOutISO: formatISODate(b.checkOut),
      numNights: differenceInDays(b.checkOut, b.checkIn),
      totalPrice: b.totalPrice.toFixed(2),
      currency: b.currency,
      status: b.status,
      bookingType: b.bookingType,
      approvedAt: b.approvedAt,
    };

    if (b.status === "cancelled") sections.cancelled.push(row);
    else if (b.status === "pending") sections.pending.push(row);
    else if (b.status === "completed" || b.checkOut < today) sections.pastOrCompleted.push(row);
    else if (b.checkIn <= today && b.checkOut > today) sections.inProgress.push(row);
    else sections.upcoming.push(row);
  }

  const hasAny = bookings.length > 0;

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {guest?.firstName ? `Hi, ${guest.firstName}` : "My bookings"}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          {hasAny
            ? "Here are your bookings."
            : "You haven't booked anything yet."}
        </p>
      </header>

      {!hasAny && (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
          <p className="text-sm text-neutral-600">
            When you book, your reservations will show up here.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Browse the property
          </Link>
        </div>
      )}

      <Section title="In progress" rows={sections.inProgress} />
      <Section title="Upcoming" rows={sections.upcoming} />
      <Section title="Awaiting payment" rows={sections.pending} />
      <Section title="Past stays" rows={sections.pastOrCompleted} />
      <Section title="Cancelled" rows={sections.cancelled} />
    </article>
  );
}

function Section({ title, rows }: { title: string; rows: BookingRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </h2>
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id}>
            <BookingCard
              id={row.id}
              propertyName={row.propertyName}
              checkIn={row.checkInISO}
              checkOut={row.checkOutISO}
              numNights={row.numNights}
              totalPrice={row.totalPrice}
              currency={row.currency}
              status={row.status}
              bookingType={row.bookingType}
              approvedAt={row.approvedAt}
              href={`/dashboard/bookings/${row.id}`}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
