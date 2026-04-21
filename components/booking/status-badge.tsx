import type { BookingStatus, BookingType } from "@/lib/generated/prisma/client";

const STYLES: Record<BookingStatus, string> = {
  pending: "bg-amber-100 text-amber-900 ring-amber-200",
  confirmed: "bg-emerald-100 text-emerald-900 ring-emerald-200",
  cancelled: "bg-neutral-100 text-neutral-700 ring-neutral-200",
  completed: "bg-blue-100 text-blue-900 ring-blue-200",
  no_show: "bg-red-100 text-red-900 ring-red-200",
};

// `pending` has three sub-states the user cares about:
//   - request-mode, not yet approved → "Awaiting approval"
//   - request-mode, approved, awaiting payment → "Awaiting payment"
//   - instant-mode → "Awaiting payment"
// The badge takes the booking-level context so the label reflects
// what the user can actually do next, not just the raw DB status.
interface BadgeProps {
  status: BookingStatus;
  bookingType?: BookingType;
  approvedAt?: Date | null;
}

function labelFor({ status, bookingType, approvedAt }: BadgeProps): string {
  if (status === "pending") {
    if (bookingType === "request" && !approvedAt) return "Awaiting approval";
    return "Awaiting payment";
  }
  switch (status) {
    case "confirmed":
      return "Confirmed";
    case "cancelled":
      return "Cancelled";
    case "completed":
      return "Completed";
    case "no_show":
      return "No show";
  }
}

export function BookingStatusBadge(props: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[props.status]}`}
    >
      {labelFor(props)}
    </span>
  );
}
