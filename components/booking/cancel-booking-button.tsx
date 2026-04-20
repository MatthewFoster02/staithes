"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  bookingId: string;
  /** Guest cancellations use softer copy than host-initiated ones. */
  canceller: "guest" | "host";
  /** Expected refund amount and policy reason. Shown in the confirm
   *  dialog so the user knows what they're agreeing to before they
   *  click. Purely cosmetic — the server re-computes authoritatively. */
  expectedRefundDisplay: string;
  expectedRefundReason: string;
}

export function CancelBookingButton({
  bookingId,
  canceller,
  expectedRefundDisplay,
  expectedRefundReason,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not cancel booking.");
        setSubmitting(false);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error.");
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" className="text-red-600 hover:text-red-700">
            Cancel booking
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this booking?</DialogTitle>
          <DialogDescription>
            {canceller === "guest"
              ? "Your refund is calculated based on the cancellation policy you agreed to at booking time."
              : "The guest will be notified by email and refunded according to the cancellation policy they booked under."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              Expected refund
            </p>
            <p className="mt-1 text-lg font-semibold text-neutral-900">
              {expectedRefundDisplay}
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {expectedRefundReason}
            </p>
          </div>
          <div>
            <label htmlFor="cancel-reason" className="text-xs font-medium text-neutral-700">
              Reason{" "}
              <span className="font-normal text-neutral-500">
                {canceller === "host" ? "(shared with the guest)" : "(optional)"}
              </span>
            </label>
            <textarea
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder={canceller === "guest" ? "Change of plans…" : "Why are you cancelling?"}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Keep booking
            </Button>
            <Button
              variant="destructive"
              onClick={submit}
              disabled={submitting}
            >
              {submitting ? "Cancelling…" : "Cancel booking"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
