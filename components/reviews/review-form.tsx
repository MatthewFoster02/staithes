"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StarRatingInput } from "@/components/reviews/star-rating-input";

interface Props {
  bookingId: string;
}

const DIMENSIONS = [
  { key: "ratingOverall", label: "Overall" },
  { key: "ratingCleanliness", label: "Cleanliness" },
  { key: "ratingAccuracy", label: "Accuracy" },
  { key: "ratingCommunication", label: "Communication" },
  { key: "ratingLocation", label: "Location" },
  { key: "ratingValue", label: "Value" },
] as const;

type Ratings = Record<(typeof DIMENSIONS)[number]["key"], number>;

const INITIAL: Ratings = {
  ratingOverall: 0,
  ratingCleanliness: 0,
  ratingAccuracy: 0,
  ratingCommunication: 0,
  ratingLocation: 0,
  ratingValue: 0,
};

export function ReviewForm({ bookingId }: Props) {
  const router = useRouter();
  const [ratings, setRatings] = React.useState<Ratings>(INITIAL);
  const [text, setText] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const allRated = Object.values(ratings).every((v) => v >= 1);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!allRated || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          ...ratings,
          reviewText: text.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not submit review.");
        setSubmitting(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-sm text-neutral-600">
        How was your stay? Your review helps the host and future guests.
      </p>
      <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        {DIMENSIONS.map((d) => (
          <StarRatingInput
            key={d.key}
            label={d.label}
            value={ratings[d.key]}
            onChange={(v) => setRatings((prev) => ({ ...prev, [d.key]: v }))}
          />
        ))}
      </div>
      <div>
        <label htmlFor="review-text" className="text-sm font-medium">
          Tell us about your stay{" "}
          <span className="font-normal text-neutral-500">(optional)</span>
        </label>
        <textarea
          id="review-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="What did you like? What could be better?"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={!allRated || submitting}>
        {submitting ? "Submitting…" : "Submit review"}
      </Button>
    </form>
  );
}
