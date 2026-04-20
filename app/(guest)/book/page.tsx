import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { checkAvailability } from "@/lib/availability/check";
import { calculatePrice } from "@/lib/pricing/calculate";
import { parseISODate } from "@/lib/availability/dates";
import { propertyPhotoUrl } from "@/lib/storage/photos";
import { BookingReviewForm } from "@/components/booking/review-form";
import { groupNightlyRates } from "@/lib/pricing/display";

export const metadata: Metadata = {
  title: "Review your booking",
};

const QuerySchema = z.object({
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.coerce.number().int().min(1).max(20),
  children: z.coerce.number().int().min(0).max(20).optional(),
});

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BookPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );

  // Validate query params first so we can build the next= redirect.
  const parsed = QuerySchema.safeParse(flat);
  if (!parsed.success) {
    redirect("/");
  }

  // Auth gate. Preserve dates so the post-login redirect lands the
  // user back on this exact review page.
  const user = await getCurrentUser();
  if (!user) {
    const qs = new URLSearchParams({
      checkIn: parsed.data.checkIn,
      checkOut: parsed.data.checkOut,
      adults: String(parsed.data.adults),
      ...(parsed.data.children !== undefined ? { children: String(parsed.data.children) } : {}),
    }).toString();
    redirect(`/login?next=${encodeURIComponent(`/book?${qs}`)}`);
  }

  const property = await prisma.property.findFirst({
    include: { photos: { orderBy: { sortOrder: "asc" }, take: 1 } },
  });
  if (!property) redirect("/");

  const checkIn = parseISODate(parsed.data.checkIn);
  const checkOut = parseISODate(parsed.data.checkOut);

  // Re-validate availability and price server-side so query params
  // can never be trusted on their own.
  const [availability, priceResult] = await Promise.all([
    checkAvailability({ propertyId: property.id, checkIn, checkOut }),
    calculatePrice({
      propertyId: property.id,
      checkIn,
      checkOut,
      numAdults: parsed.data.adults,
      numChildren: parsed.data.children,
    }),
  ]);

  if (!availability.available) {
    return <UnavailableState message={availability.message} />;
  }
  if (!priceResult.ok) {
    return <UnavailableState message={priceResult.message} />;
  }

  const breakdown = priceResult.breakdown;
  const heroPhoto = property.photos[0];
  const totalGuests = parsed.data.adults + (parsed.data.children ?? 0);

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight sm:text-3xl">
        Review and confirm
      </h1>

      <div className="grid gap-8 md:grid-cols-[1fr_auto]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-neutral-200 p-5">
            <div className="flex gap-4">
              {heroPhoto && (
                <div className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                  <Image
                    src={propertyPhotoUrl(heroPhoto.url)}
                    alt={heroPhoto.altText}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-base font-semibold">{property.name}</p>
                <p className="mt-1 text-sm text-neutral-600">{property.addressApprox}</p>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3 rounded-2xl border border-neutral-200 p-5 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Check-in</dt>
              <dd className="mt-1 font-medium">{formatDateLong(parsed.data.checkIn)}</dd>
              <dd className="text-xs text-neutral-500">From {property.checkInTime}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Check-out</dt>
              <dd className="mt-1 font-medium">{formatDateLong(parsed.data.checkOut)}</dd>
              <dd className="text-xs text-neutral-500">By {property.checkOutTime}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Guests</dt>
              <dd className="mt-1 font-medium">
                {totalGuests} {totalGuests === 1 ? "guest" : "guests"}
                {(parsed.data.children ?? 0) > 0 && (
                  <span className="ml-1 text-neutral-500">
                    ({parsed.data.adults} adult{parsed.data.adults === 1 ? "" : "s"},{" "}
                    {parsed.data.children} {parsed.data.children === 1 ? "child" : "children"})
                  </span>
                )}
              </dd>
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 p-5">
            <BookingReviewForm
              checkIn={parsed.data.checkIn}
              checkOut={parsed.data.checkOut}
              adults={parsed.data.adults}
              numChildren={parsed.data.children ?? 0}
              instantBookingEnabled={property.instantBookingEnabled}
            />
          </section>
        </div>

        <aside className="md:w-64">
          <dl className="space-y-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-sm">
            <p className="mb-3 text-base font-semibold text-neutral-900">Price details</p>
            {groupNightlyRates(breakdown.nightlyRates).map((group, i) => (
              <Row
                key={i}
                label={`${formatMoney(group.rate, breakdown.currency)} × ${group.nights} ${group.nights === 1 ? "night" : "nights"}`}
                value={formatMoney(group.subtotal, breakdown.currency)}
              />
            ))}
            {Number(breakdown.extraGuestFeeTotal) > 0 && (
              <Row
                label="Extra guests"
                value={formatMoney(breakdown.extraGuestFeeTotal, breakdown.currency)}
              />
            )}
            <Row
              label="Cleaning fee"
              value={formatMoney(breakdown.cleaningFee, breakdown.currency)}
            />
            {Number(breakdown.discountAmount) > 0 && (
              <Row
                label={breakdown.discountDescription ?? "Discount"}
                value={`−${formatMoney(breakdown.discountAmount, breakdown.currency)}`}
              />
            )}
            <div className="my-2 border-t border-neutral-200" />
            <Row
              label="Total"
              value={formatMoney(breakdown.total, breakdown.currency)}
              emphasis
            />
          </dl>
        </aside>
      </div>
    </article>
  );
}

function Row({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`flex justify-between ${emphasis ? "text-base font-semibold text-neutral-900" : "text-neutral-700"}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function UnavailableState({ message }: { message: string }) {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 py-12 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">These dates aren&rsquo;t available</h1>
      <p className="mt-3 text-sm text-neutral-600">{message}</p>
      <Link
        href="/"
        className="mt-8 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Back to the property
      </Link>
    </section>
  );
}

function formatDateLong(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

const CURRENCY_SYMBOLS: Record<string, string> = { GBP: "£", EUR: "€", USD: "$" };

function formatMoney(value: string, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${symbol}${Number(value).toFixed(2)}`;
}
