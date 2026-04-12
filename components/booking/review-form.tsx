"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

interface ReviewFormProps {
  checkIn: string;
  checkOut: string;
  adults: number;
  numChildren: number;
}

export function BookingReviewForm({ checkIn, checkOut, adults, numChildren }: ReviewFormProps) {
  const [guestMessage, setGuestMessage] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkIn,
          checkOut,
          adults,
          children: numChildren,
          guestMessage: guestMessage.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.checkoutUrl) {
        setError(data.error ?? "Could not start checkout.");
        setSubmitting(false);
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="guest-message" className="text-sm font-medium">
          Anything we should know about your stay?
          <span className="ml-1 text-xs font-normal text-neutral-500">(optional)</span>
        </label>
        <textarea
          id="guest-message"
          value={guestMessage}
          onChange={(e) => setGuestMessage(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="Arrival time, dietary requirements, anything that helps us prepare…"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <p className="text-xs text-neutral-500">{guestMessage.length} / 1000</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Redirecting to payment…" : "Continue to payment"}
      </Button>
      <p className="text-center text-xs text-neutral-500">
        You won&rsquo;t be charged until you confirm on the next page.
      </p>
    </form>
  );
}
