import type { BookingStatus } from "@/lib/generated/prisma/client";

const STYLES: Record<BookingStatus, string> = {
  pending: "bg-amber-100 text-amber-900 ring-amber-200",
  confirmed: "bg-emerald-100 text-emerald-900 ring-emerald-200",
  cancelled: "bg-neutral-100 text-neutral-700 ring-neutral-200",
  completed: "bg-blue-100 text-blue-900 ring-blue-200",
  no_show: "bg-red-100 text-red-900 ring-red-200",
};

const LABELS: Record<BookingStatus, string> = {
  pending: "Awaiting payment",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed",
  no_show: "No show",
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
