import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { propertyPhotoUrl } from "@/lib/storage/photos";
import { differenceInDays, formatISODate } from "@/lib/availability/dates";
import { BookingStatusBadge } from "@/components/booking/status-badge";
import { CancelBookingButton } from "@/components/booking/cancel-booking-button";
import { RequestApprovalButtons } from "@/components/admin/request-approval-buttons";
import { groupNightlyRates } from "@/lib/pricing/display";
import { canCancel, previewRefund } from "@/lib/booking/cancel";
import type { Prisma } from "@/lib/generated/prisma/client";

export const metadata: Metadata = {
  title: "Admin · Booking detail",
};

const CURRENCY_SYMBOLS: Record<string, string> = { GBP: "£", EUR: "€", USD: "$" };

function formatMoney(value: string, currency: string): string {
  return `${CURRENCY_SYMBOLS[currency] ?? `${currency} `}${Number(value).toFixed(2)}`;
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

function formatDateTime(date: Date): string {
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface NightlyRate {
  date: string;
  rate: string;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

// Host's view of a single booking. Layout proxy + admin layout already
// guarantee the visitor is a host, so no per-page auth check needed.
// The host always sees the full address and guest contact details —
// no privacy gating like the guest detail page.
export default async function AdminBookingDetailPage({ params }: PageProps) {
  const { id } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      guest: true,
      property: { include: { photos: { orderBy: { sortOrder: "asc" }, take: 1 } } },
      priceSnapshot: true,
      payments: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!booking) notFound();

  const checkInISO = formatISODate(booking.checkIn);
  const checkOutISO = formatISODate(booking.checkOut);
  const numNights = differenceInDays(booking.checkOut, booking.checkIn);
  const heroPhoto = booking.property.photos[0];
  const totalGuests = booking.numGuestsAdults + booking.numGuestsChildren;
  const snapshot = booking.priceSnapshot;
  const nightlyRates =
    (snapshot?.nightlyRates as Prisma.JsonValue as NightlyRate[] | null) ?? null;
  const rateGroups = nightlyRates ? groupNightlyRates(nightlyRates) : [];

  const eligibleForCancel = canCancel(booking, "host");
  const refundPreview = eligibleForCancel ? previewRefund(booking, "host") : null;

  return (
    <article className="mx-auto max-w-5xl px-6 py-10">
      <Link
        href="/admin/bookings"
        className="mb-6 inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900"
      >
        <ArrowLeftIcon className="size-4" />
        All bookings
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {booking.guest.firstName} {booking.guest.lastName}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Booking <code>{booking.id.slice(0, 8).toUpperCase()}</code> · created{" "}
            {formatDateTime(booking.createdAt)}
          </p>
        </div>
        <BookingStatusBadge
          status={booking.status}
          bookingType={booking.bookingType}
          approvedAt={booking.approvedAt}
        />
      </header>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {heroPhoto && (
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-neutral-100">
              <Image
                src={propertyPhotoUrl(heroPhoto.url)}
                alt={heroPhoto.altText}
                fill
                sizes="(max-width: 1024px) 100vw, 700px"
                className="object-cover"
              />
            </div>
          )}

          <section className="rounded-2xl border border-neutral-200 bg-white p-5">
            <h2 className="mb-4 text-base font-semibold">Stay</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">Check-in</dt>
                <dd className="mt-1 font-medium">{formatDateLong(checkInISO)}</dd>
                <dd className="text-xs text-neutral-500">From {booking.property.checkInTime}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">Check-out</dt>
                <dd className="mt-1 font-medium">{formatDateLong(checkOutISO)}</dd>
                <dd className="text-xs text-neutral-500">By {booking.property.checkOutTime}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">Nights</dt>
                <dd className="mt-1 font-medium">{numNights}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">Guests</dt>
                <dd className="mt-1 font-medium">
                  {totalGuests}{" "}
                  <span className="text-xs text-neutral-500">
                    ({booking.numGuestsAdults} adult{booking.numGuestsAdults === 1 ? "" : "s"}
                    {booking.numGuestsChildren > 0 &&
                      `, ${booking.numGuestsChildren} ${booking.numGuestsChildren === 1 ? "child" : "children"}`}
                    )
                  </span>
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs uppercase tracking-wide text-neutral-500">Property</dt>
                <dd className="mt-1 font-medium">{booking.property.name}</dd>
                <dd className="text-xs text-neutral-500">{booking.property.addressFull}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-5">
            <h2 className="mb-4 text-base font-semibold">Guest contact</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">Name</dt>
                <dd className="mt-1 font-medium">
                  {booking.guest.firstName} {booking.guest.lastName}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">Email</dt>
                <dd className="mt-1 font-medium">
                  <a
                    href={`mailto:${booking.guest.email}`}
                    className="text-neutral-900 hover:underline"
                  >
                    {booking.guest.email}
                  </a>
                </dd>
              </div>
              {booking.guest.phone && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Phone</dt>
                  <dd className="mt-1 font-medium">{booking.guest.phone}</dd>
                </div>
              )}
              {booking.guest.country && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Country</dt>
                  <dd className="mt-1 font-medium">{booking.guest.country}</dd>
                </div>
              )}
            </dl>
          </section>

          {booking.guestMessage && (
            <section className="rounded-2xl border border-neutral-200 bg-white p-5">
              <h2 className="mb-3 text-base font-semibold">Guest message</h2>
              <p className="whitespace-pre-line text-sm text-neutral-700">{booking.guestMessage}</p>
            </section>
          )}

          {booking.status === "cancelled" && (
            <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
              <h2 className="mb-2 text-base font-semibold">Cancelled</h2>
              {booking.cancellationReason && (
                <p className="text-sm text-neutral-700">
                  Reason: <code className="text-xs">{booking.cancellationReason}</code>
                </p>
              )}
              {booking.cancelledAt && (
                <p className="mt-1 text-xs text-neutral-500">
                  on {formatDateTime(booking.cancelledAt)}
                </p>
              )}
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-neutral-200 bg-white p-5">
            <h2 className="mb-3 text-base font-semibold">Price</h2>
            {snapshot ? (
              <dl className="space-y-2 text-sm text-neutral-700">
                {rateGroups.length > 0 ? (
                  rateGroups.map((group, i) => (
                    <Row
                      key={i}
                      label={`${formatMoney(group.rate, snapshot.currency)} × ${group.nights} ${group.nights === 1 ? "night" : "nights"}`}
                      value={formatMoney(group.subtotal, snapshot.currency)}
                    />
                  ))
                ) : (
                  <Row
                    label={`Nightly × ${snapshot.numNights} ${snapshot.numNights === 1 ? "night" : "nights"}`}
                    value={formatMoney(snapshot.subtotalAccommodation.toFixed(2), snapshot.currency)}
                  />
                )}
                {Number(snapshot.extraGuestFeeTotal) > 0 && (
                  <Row
                    label="Extra guests"
                    value={formatMoney(snapshot.extraGuestFeeTotal.toFixed(2), snapshot.currency)}
                  />
                )}
                {Number(snapshot.cleaningFee) > 0 && (
                  <Row
                    label="Cleaning fee"
                    value={formatMoney(snapshot.cleaningFee.toFixed(2), snapshot.currency)}
                  />
                )}
                {Number(snapshot.discountAmount) > 0 && (
                  <Row
                    label={snapshot.discountDescription ?? "Discount"}
                    value={`−${formatMoney(snapshot.discountAmount.toFixed(2), snapshot.currency)}`}
                  />
                )}
                <div className="my-2 border-t border-neutral-200" />
                <Row
                  label="Total"
                  value={formatMoney(snapshot.total.toFixed(2), snapshot.currency)}
                  emphasis
                />
              </dl>
            ) : (
              <p className="text-sm text-neutral-700">
                Total:{" "}
                <span className="font-semibold">
                  {formatMoney(booking.totalPrice.toFixed(2), booking.currency)}
                </span>
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-5">
            <h2 className="mb-3 text-base font-semibold">Payments</h2>
            {booking.payments.length === 0 ? (
              <p className="text-sm text-neutral-500">No payments yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {booking.payments.map((payment) => (
                  <li key={payment.id} className="flex justify-between text-neutral-700">
                    <div className="min-w-0">
                      <p className="font-medium capitalize">{payment.type.replace("_", " ")}</p>
                      <p className="text-xs text-neutral-500">
                        {payment.gateway}
                        {payment.cardBrand && payment.cardLastFour && (
                          <> · {payment.cardBrand} •••• {payment.cardLastFour}</>
                        )}
                      </p>
                      {payment.gatewayTransactionId && (
                        <p className="truncate text-xs text-neutral-400">
                          {payment.gatewayTransactionId}
                        </p>
                      )}
                    </div>
                    <span className="font-medium">
                      {formatMoney(payment.amount.toFixed(2), payment.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {booking.bookingType === "request" &&
            booking.status === "pending" &&
            !booking.approvedAt && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <h2 className="mb-2 text-base font-semibold">Booking request</h2>
                <p className="mb-3 text-sm text-neutral-700">
                  The guest has requested to book these dates. Approve to
                  send them a payment link, or decline to cancel.
                </p>
                <RequestApprovalButtons bookingId={booking.id} />
              </section>
            )}

          {eligibleForCancel && refundPreview && (
            <section className="rounded-2xl border border-neutral-200 bg-white p-5">
              <h2 className="mb-3 text-base font-semibold">Cancel</h2>
              <p className="mb-3 text-sm text-neutral-600">
                Cancelling will refund the guest{" "}
                <strong>
                  {booking.currency === "GBP" ? "£" : `${booking.currency} `}
                  {refundPreview.amount}
                </strong>{" "}
                ({refundPreview.reason}).
              </p>
              <CancelBookingButton
                bookingId={booking.id}
                canceller="host"
                expectedRefundDisplay={`${booking.currency === "GBP" ? "£" : `${booking.currency} `}${refundPreview.amount}`}
                expectedRefundReason={refundPreview.reason}
              />
            </section>
          )}
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
    <div className={`flex justify-between ${emphasis ? "text-base font-semibold text-neutral-900" : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
