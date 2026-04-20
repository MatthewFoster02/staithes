import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect, notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { propertyPhotoUrl } from "@/lib/storage/photos";
import { differenceInDays, formatISODate } from "@/lib/availability/dates";
import { BookingStatusBadge } from "@/components/booking/status-badge";
import { CancelBookingButton } from "@/components/booking/cancel-booking-button";
import { ReviewForm } from "@/components/reviews/review-form";
import { todayUTC } from "@/lib/availability/dates";
import { groupNightlyRates } from "@/lib/pricing/display";
import { previewRefund } from "@/lib/booking/cancel";
import type { CancellationPolicy, Prisma } from "@/lib/generated/prisma/client";

export const metadata: Metadata = {
  title: "Booking details",
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

interface NightlyRate {
  date: string;
  rate: string;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BookingDetailPage({ params }: PageProps) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/dashboard/bookings/${id}`);

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      property: { include: { photos: { orderBy: { sortOrder: "asc" }, take: 1 } } },
      priceSnapshot: true,
      payments: { orderBy: { createdAt: "asc" } },
      review: true,
    },
  });

  // 404 covers both "doesn't exist" and "exists but not yours" — we
  // deliberately don't tell the user a booking they don't own exists.
  if (!booking || booking.guestId !== user.id) {
    notFound();
  }

  const checkInISO = formatISODate(booking.checkIn);
  const checkOutISO = formatISODate(booking.checkOut);
  const numNights = differenceInDays(booking.checkOut, booking.checkIn);
  const heroPhoto = booking.property.photos[0];
  const totalGuests = booking.numGuestsAdults + booking.numGuestsChildren;
  const snapshot = booking.priceSnapshot;
  const nightlyRates = (snapshot?.nightlyRates as Prisma.JsonValue as NightlyRate[] | null) ?? null;
  const rateGroups = nightlyRates ? groupNightlyRates(nightlyRates) : [];

  // The exact address is intentionally only revealed once the booking
  // is confirmed (per the data model spec). Pending bookings see the
  // approximate location only.
  const showFullAddress = booking.status === "confirmed" || booking.status === "completed";

  // Reviewable when the stay is over and there isn't already a review.
  const eligibleForReview =
    !booking.review &&
    (booking.status === "confirmed" || booking.status === "completed") &&
    booking.checkOut <= todayUTC();

  // Cancellable when the stay hasn't happened yet and the booking is
  // still live.
  const eligibleForCancel =
    (booking.status === "pending" || booking.status === "confirmed") &&
    booking.checkOut > todayUTC();
  const refundPreview = eligibleForCancel
    ? previewRefund(
        booking.totalPrice,
        ((booking.cancellationPolicySnapshot as Prisma.JsonObject)?.policy as CancellationPolicy) ??
          "moderate",
        Math.max(0, differenceInDays(booking.checkIn, todayUTC())),
      )
    : null;

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900"
      >
        <ArrowLeftIcon className="size-4" />
        All bookings
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {booking.property.name}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Booking reference: {booking.id.slice(0, 8).toUpperCase()}
          </p>
        </div>
        <BookingStatusBadge status={booking.status} />
      </header>

      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {heroPhoto && (
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-neutral-100">
              <Image
                src={propertyPhotoUrl(heroPhoto.url)}
                alt={heroPhoto.altText}
                fill
                sizes="(max-width: 768px) 100vw, 600px"
                className="object-cover"
              />
            </div>
          )}

          <section className="rounded-2xl border border-neutral-200 p-5">
            <h2 className="mb-4 text-base font-semibold">Your stay</h2>
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
                  {totalGuests}
                  {booking.numGuestsChildren > 0 && (
                    <span className="ml-1 text-xs text-neutral-500">
                      ({booking.numGuestsAdults} adult{booking.numGuestsAdults === 1 ? "" : "s"},{" "}
                      {booking.numGuestsChildren} {booking.numGuestsChildren === 1 ? "child" : "children"})
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-neutral-200 p-5">
            <h2 className="mb-3 text-base font-semibold">Where you&rsquo;re staying</h2>
            {showFullAddress ? (
              <p className="text-sm text-neutral-700">{booking.property.addressFull}</p>
            ) : (
              <>
                <p className="text-sm text-neutral-700">{booking.property.addressApprox}</p>
                <p className="mt-2 text-xs text-neutral-500">
                  The exact address will be shared once your booking is confirmed.
                </p>
              </>
            )}
          </section>

          {booking.guestMessage && (
            <section className="rounded-2xl border border-neutral-200 p-5">
              <h2 className="mb-3 text-base font-semibold">Your message to the host</h2>
              <p className="whitespace-pre-line text-sm text-neutral-700">{booking.guestMessage}</p>
            </section>
          )}

          {eligibleForReview && (
            <section className="rounded-2xl border border-neutral-200 p-5">
              <h2 className="mb-3 text-base font-semibold">Leave a review</h2>
              <ReviewForm bookingId={booking.id} />
            </section>
          )}

          {booking.review && (
            <section className="rounded-2xl border border-neutral-200 bg-emerald-50 p-5">
              <h2 className="mb-2 text-base font-semibold">Your review</h2>
              <p className="text-sm text-neutral-700">
                You rated this stay <strong>{Number(booking.review.ratingOverall).toFixed(1)} / 5</strong>.
              </p>
              {booking.review.reviewText && (
                <p className="mt-2 whitespace-pre-line text-sm text-neutral-700">
                  &ldquo;{booking.review.reviewText}&rdquo;
                </p>
              )}
            </section>
          )}

          {booking.bookingType === "request" && booking.status === "pending" && (
            <section
              className={`rounded-2xl border p-5 ${
                booking.approvedAt
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-amber-200 bg-amber-50"
              }`}
            >
              <h2 className="mb-2 text-base font-semibold">
                {booking.approvedAt ? "Approved — complete payment" : "Awaiting host approval"}
              </h2>
              <p className="text-sm text-neutral-700">
                {booking.approvedAt
                  ? "The host has approved your request. Check your email for the payment link — the booking is only held for 24 hours after approval."
                  : "Your request has been sent to the host. You'll get an email with a payment link once they approve."}
              </p>
            </section>
          )}

          {eligibleForCancel && refundPreview && (
            <section className="rounded-2xl border border-neutral-200 p-5">
              <h2 className="mb-2 text-base font-semibold">Cancel</h2>
              <p className="mb-3 text-sm text-neutral-600">
                Based on the cancellation policy you agreed to, you&rsquo;d be
                refunded{" "}
                <strong>
                  {booking.currency === "GBP" ? "£" : `${booking.currency} `}
                  {refundPreview.amount}
                </strong>{" "}
                ({refundPreview.reason}).
              </p>
              <CancelBookingButton
                bookingId={booking.id}
                canceller="guest"
                expectedRefundDisplay={`${booking.currency === "GBP" ? "£" : `${booking.currency} `}${refundPreview.amount}`}
                expectedRefundReason={refundPreview.reason}
              />
            </section>
          )}

          {booking.status === "cancelled" && booking.cancellationReason && (
            <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
              <h2 className="mb-2 text-base font-semibold">Cancelled</h2>
              <p className="text-sm text-neutral-700">
                Reason: <code className="text-xs">{booking.cancellationReason}</code>
              </p>
              {booking.cancelledAt && (
                <p className="mt-1 text-xs text-neutral-500">
                  on {formatDateLong(formatISODate(booking.cancelledAt))}
                </p>
              )}
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
            <h2 className="mb-3 text-base font-semibold">Price details</h2>
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
                {Number(snapshot.taxAmount) > 0 && (
                  <Row
                    label={snapshot.taxDescription ?? "Tax"}
                    value={formatMoney(snapshot.taxAmount.toFixed(2), snapshot.currency)}
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

          {booking.payments.length > 0 && (
            <section className="rounded-2xl border border-neutral-200 p-5">
              <h2 className="mb-3 text-base font-semibold">Payment</h2>
              <ul className="space-y-2 text-sm">
                {booking.payments.map((payment) => (
                  <li key={payment.id} className="flex justify-between text-neutral-700">
                    <span>
                      {payment.type === "charge" ? "Paid" : payment.type}
                      {payment.cardBrand && payment.cardLastFour && (
                        <span className="ml-1 text-xs text-neutral-500">
                          {payment.cardBrand} •••• {payment.cardLastFour}
                        </span>
                      )}
                    </span>
                    <span className="font-medium">
                      {formatMoney(payment.amount.toFixed(2), payment.currency)}
                    </span>
                  </li>
                ))}
              </ul>
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
