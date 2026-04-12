import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin · Dashboard",
};

// Placeholder. Task 3.6 fills this in with summary cards (bookings
// this month, occupancy, revenue, etc.). Task 3.4 adds /admin/bookings
// for the booking management list, and 3.5 adds /admin/calendar.
export default function AdminDashboardPage() {
  return (
    <article className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          The host overview lives here. Bookings, calendar, and finance
          summary cards land in Task 3.6.
        </p>
      </header>
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
        <p className="text-sm text-neutral-500">
          Coming soon: today&rsquo;s arrivals, upcoming bookings,
          occupancy, revenue.
        </p>
      </div>
    </article>
  );
}
