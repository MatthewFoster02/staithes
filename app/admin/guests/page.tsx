import type { Metadata } from "next";
import { z } from "zod";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = {
  title: "Admin · Guests",
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "opted-in", label: "Opted in" },
  { value: "opted-out", label: "Opted out" },
] as const;

const QuerySchema = z.object({
  filter: z.enum(["all", "opted-in", "opted-out"]).default("all"),
  q: z.string().optional(),
});

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminGuestsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  const filters = QuerySchema.parse(flat);

  const guests = await prisma.guest.findMany({
    where: {
      ...(filters.filter === "opted-in" ? { marketingOptIn: true } : {}),
      ...(filters.filter === "opted-out" ? { marketingOptIn: false } : {}),
      ...(filters.q
        ? {
            OR: [
              { firstName: { contains: filters.q, mode: "insensitive" } },
              { lastName: { contains: filters.q, mode: "insensitive" } },
              { email: { contains: filters.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { bookings: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const optedInCount = await prisma.guest.count({ where: { marketingOptIn: true } });

  const exportUrl = new URLSearchParams();
  if (filters.filter !== "all") exportUrl.set("filter", filters.filter);

  return (
    <article className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Guests</h1>
          <p className="mt-1 text-sm text-neutral-600">
            {optedInCount} guest{optedInCount === 1 ? " has" : "s have"} opted in
            to marketing.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/api/admin/guests/export${exportUrl.toString() ? `?${exportUrl.toString()}` : ""}`}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            Export CSV
          </Link>
          <Link
            href="/admin/guests/newsletter"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Send newsletter
          </Link>
        </div>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Marketing
          </span>
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={f.value === "all" ? "/admin/guests" : `/admin/guests?filter=${f.value}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                filters.filter === f.value
                  ? "bg-neutral-900 text-white"
                  : "bg-white text-neutral-700 ring-1 ring-inset ring-neutral-300 hover:bg-neutral-100"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <form method="get" className="ml-auto flex max-w-sm gap-2">
          {filters.filter !== "all" && <input type="hidden" name="filter" value={filters.filter} />}
          <input
            type="text"
            name="q"
            placeholder="Search name or email…"
            defaultValue={filters.q ?? ""}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Search
          </button>
        </form>
      </div>

      {guests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
          No guests match these filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3 text-right">Bookings</th>
                <th className="px-4 py-3">Marketing</th>
                <th className="px-4 py-3 text-right">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {guests.map((g) => (
                <tr key={g.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium text-neutral-900">
                    {g.firstName} {g.lastName}
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    <a href={`mailto:${g.email}`} className="hover:underline">
                      {g.email}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{g.country ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-neutral-700">
                    {g._count.bookings}
                  </td>
                  <td className="px-4 py-3">
                    {g.marketingOptIn ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
                        Opted in
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-neutral-500">
                    {g.createdAt.toLocaleDateString("en-GB")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
