"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// Host's approve / decline buttons for a request-to-book booking.
// Shown only when booking.bookingType = "request" AND booking.status
// = "pending" AND booking.approvedAt is null. After approval the
// guest sees "complete payment" on their own dashboard; the host
// can also copy the returned Stripe URL and send it manually if the
// email doesn't arrive.
export function RequestApprovalButtons({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [approvedUrl, setApprovedUrl] = React.useState<string | null>(null);

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/approve`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not approve.");
        setBusy(false);
        return;
      }
      setApprovedUrl(data.checkoutUrl ?? null);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    const reason = window.prompt("Optional reason for declining (shown to guest):") ?? undefined;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not decline.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (approvedUrl) {
    return (
      <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
        <p className="font-medium text-emerald-900">Approved — payment link sent</p>
        <p className="text-neutral-700">
          The guest has been emailed a payment link. If you need to share it
          manually, copy the URL below.
        </p>
        <input
          readOnly
          value={approvedUrl}
          className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1 font-mono text-xs"
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button onClick={approve} disabled={busy}>
          {busy ? "Approving…" : "Approve request"}
        </Button>
        <Button variant="outline" onClick={decline} disabled={busy}>
          Decline
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
