import Link from "next/link";
import type { BookingStatus } from "@/lib/generated/prisma/client";
import { BookingStatusBadge } from "@/components/booking/status-badge";

export interface BookingCardProps {
  id: string;
  propertyName: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  numNights: number;
  totalPrice: string; // decimal string
  currency: string;
  status: BookingStatus;
  href: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = { GBP: "£", EUR: "€", USD: "$" };

function formatMoney(value: string, currency: string): string {
  return `${CURRENCY_SYMBOLS[currency] ?? `${currency} `}${Number(value).toFixed(0)}`;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function BookingCard({
  propertyName,
  checkIn,
  checkOut,
  numNights,
  totalPrice,
  currency,
  status,
  href,
}: BookingCardProps) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-neutral-200 p-5 transition hover:border-neutral-300 hover:shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-neutral-900">{propertyName}</p>
          <p className="mt-1 text-sm text-neutral-600">
            {formatDate(checkIn)} → {formatDate(checkOut)}
            <span className="ml-2 text-neutral-500">
              · {numNights} {numNights === 1 ? "night" : "nights"}
            </span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <BookingStatusBadge status={status} />
          <p className="text-base font-semibold text-neutral-900">
            {formatMoney(totalPrice, currency)}
          </p>
        </div>
      </div>
    </Link>
  );
}
