"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Matcher } from "react-day-picker";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatISODate } from "@/lib/availability/dates";

export type CalendarDayEntry =
  | {
      type: "confirmed" | "pending";
      bookingId: string;
      guestName: string;
    }
  | {
      type: "blocked";
      blockedDateId: string;
      reason: string | null;
      rangeStart: string;
      rangeEnd: string;
    };

interface AdminCalendarProps {
  viewYear: number;
  viewMonth: number; // 0-indexed
  days: Record<string, CalendarDayEntry>;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthQuery(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function AdminCalendar({ viewYear, viewMonth, days }: AdminCalendarProps) {
  const router = useRouter();

  // Navigation links — server re-renders the page with new month data.
  const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
  const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
  const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
  const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
  const today = new Date();
  const todayMonthQs = monthQuery(today.getUTCFullYear(), today.getUTCMonth());

  const matchByType = (type: CalendarDayEntry["type"]): Matcher => {
    return (day: Date) => {
      const entry = days[formatISODate(day)];
      return entry?.type === type;
    };
  };

  const pickStartMatcher: Matcher = (day: Date) =>
    pickStart !== null && formatISODate(day) === formatISODate(pickStart);

  const modifiers = {
    confirmedBooking: matchByType("confirmed"),
    pendingBooking: matchByType("pending"),
    blocked: matchByType("blocked"),
    pickStart: pickStartMatcher,
  };

  // Two-click range picker for blocking dates:
  //   1. First click on an empty day sets `pickStart` and shows a hint.
  //   2. Second click on another empty day (or the same day) opens the
  //      modal with both dates pre-filled. Modal is purely confirm + reason.
  // Pressing Escape, clicking the hint Cancel button, or clicking a
  // booking/blocked day all cancel the in-progress pick.
  const [pickStart, setPickStart] = React.useState<Date | null>(null);
  const [rangeStart, setRangeStart] = React.useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = React.useState<Date | null>(null);
  const [modalKind, setModalKind] = React.useState<"block" | "view-blocked" | null>(null);
  const [viewBlocked, setViewBlocked] = React.useState<Extract<CalendarDayEntry, { type: "blocked" }> | null>(null);
  const [reason, setReason] = React.useState<string>("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function closeModal() {
    setModalKind(null);
    setRangeStart(null);
    setRangeEnd(null);
    setViewBlocked(null);
    setReason("");
    setError(null);
    setSubmitting(false);
  }

  function cancelPick() {
    setPickStart(null);
  }

  // Cancel the in-progress pick on Escape.
  React.useEffect(() => {
    if (!pickStart) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelPick();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [pickStart]);

  function handleDayClick(day: Date) {
    const key = formatISODate(day);
    const entry = days[key];

    // Clicking anything other than an empty day cancels any
    // in-progress range pick before doing the normal action.
    if (entry?.type === "confirmed" || entry?.type === "pending") {
      cancelPick();
      router.push(`/admin/bookings/${entry.bookingId}`);
      return;
    }
    if (entry?.type === "blocked") {
      cancelPick();
      setViewBlocked(entry);
      setModalKind("view-blocked");
      return;
    }

    // Empty day. Two-click range pick:
    if (!pickStart) {
      setPickStart(day);
      return;
    }

    // Second click — order the pair so end >= start, then open the modal.
    const [start, end] = day < pickStart ? [day, pickStart] : [pickStart, day];
    setRangeStart(start);
    setRangeEnd(end);
    setPickStart(null);
    setModalKind("block");
  }

  async function submitBlock() {
    if (!rangeStart || !rangeEnd) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/blocked-dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateStart: formatISODate(rangeStart),
          dateEnd: formatISODate(rangeEnd),
          reason: reason.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not block these dates.");
        setSubmitting(false);
        return;
      }
      closeModal();
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  async function submitUnblock(blockedDateId: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/blocked-dates/${blockedDateId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not unblock.");
        setSubmitting(false);
        return;
      }
      closeModal();
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  const numNights =
    rangeStart && rangeEnd
      ? Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86400000) + 1
      : 0;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/admin/calendar?month=${monthQuery(prevYear, prevMonth)}`}
          className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100"
        >
          <ChevronLeftIcon className="size-4" />
          Prev
        </Link>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </h2>
          {monthQuery(viewYear, viewMonth) !== todayMonthQs && (
            <Link
              href="/admin/calendar"
              className="text-xs text-neutral-600 underline-offset-4 hover:underline"
            >
              Today
            </Link>
          )}
        </div>
        <Link
          href={`/admin/calendar?month=${monthQuery(nextYear, nextMonth)}`}
          className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100"
        >
          Next
          <ChevronRightIcon className="size-4" />
        </Link>
      </div>

      {pickStart && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm">
          <span className="text-sky-900">
            Block from <strong>{formatISODate(pickStart)}</strong> — now click the last
            night, or click the same day for one night.
          </span>
          <button
            type="button"
            onClick={cancelPick}
            className="cursor-pointer text-xs font-medium text-sky-900 underline-offset-4 hover:underline"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <Calendar
          mode="single"
          month={new Date(viewYear, viewMonth, 1)}
          hideNavigation
          onDayClick={handleDayClick}
          modifiers={modifiers}
          modifiersClassNames={{
            confirmedBooking: "[&>button]:bg-emerald-200 [&>button]:text-emerald-900 [&>button]:font-semibold",
            pendingBooking: "[&>button]:bg-amber-100 [&>button]:text-amber-900",
            blocked: "[&>button]:bg-neutral-300 [&>button]:text-neutral-700",
            pickStart: "[&>button]:ring-2 [&>button]:ring-sky-500 [&>button]:ring-inset",
          }}
          classNames={{
            day: "[&>button]:cursor-pointer",
          }}
        />

        <Legend />
      </div>

      {/* Confirm-block modal */}
      <Dialog
        open={modalKind === "block"}
        onOpenChange={(open) => !open && closeModal()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block these dates?</DialogTitle>
            <DialogDescription>
              These nights will be marked unavailable for booking. Use this for
              personal stays, cleans, maintenance — anything you don&rsquo;t want
              guests booking.
            </DialogDescription>
          </DialogHeader>
          {rangeStart && rangeEnd && (
            <div className="space-y-4">
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
                <p className="font-medium text-neutral-900">
                  {formatISODate(rangeStart)}
                  {formatISODate(rangeEnd) !== formatISODate(rangeStart) && (
                    <> → {formatISODate(rangeEnd)}</>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {numNights} {numNights === 1 ? "night" : "nights"}
                </p>
              </div>
              <div>
                <label htmlFor="block-reason" className="text-xs font-medium text-neutral-700">
                  Reason <span className="font-normal text-neutral-500">(optional, internal only)</span>
                </label>
                <input
                  id="block-reason"
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Personal use, cleaning, maintenance…"
                  className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeModal} disabled={submitting}>
                  Cancel
                </Button>
                <Button onClick={submitBlock} disabled={submitting}>
                  {submitting ? "Blocking…" : "Block"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View-blocked modal */}
      <Dialog
        open={modalKind === "view-blocked"}
        onOpenChange={(open) => !open && closeModal()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Blocked dates</DialogTitle>
            <DialogDescription>
              These dates are unavailable for booking.
            </DialogDescription>
          </DialogHeader>
          {viewBlocked && (
            <div className="space-y-4">
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-xs font-medium text-neutral-500">Range</dt>
                  <dd className="mt-1 font-medium">
                    {viewBlocked.rangeStart}
                    {viewBlocked.rangeEnd !== viewBlocked.rangeStart && (
                      <> → {viewBlocked.rangeEnd}</>
                    )}
                  </dd>
                </div>
                {viewBlocked.reason && (
                  <div>
                    <dt className="text-xs font-medium text-neutral-500">Reason</dt>
                    <dd className="mt-1">{viewBlocked.reason}</dd>
                  </div>
                )}
              </dl>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeModal} disabled={submitting}>
                  Close
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => submitUnblock(viewBlocked.blockedDateId)}
                  disabled={submitting}
                >
                  {submitting ? "Unblocking…" : "Unblock"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-neutral-200 pt-3 text-xs text-neutral-600">
      <LegendItem className="bg-emerald-200" label="Confirmed booking" />
      <LegendItem className="bg-amber-100" label="Pending booking" />
      <LegendItem className="bg-neutral-300" label="Blocked" />
    </div>
  );
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-3 rounded-sm ${className}`} />
      {label}
    </span>
  );
}
