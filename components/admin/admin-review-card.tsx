"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export interface AdminReviewItem {
  id: string;
  guestName: string;
  guestEmail: string;
  ratingOverall: number;
  ratingCleanliness: number;
  ratingAccuracy: number;
  ratingCommunication: number;
  ratingLocation: number;
  ratingValue: number;
  reviewText: string | null;
  hostResponse: string | null;
  hostRespondedAtISO: string | null;
  isPublished: boolean;
  createdAtISO: string;
  bookingHref: string;
}

const DIMENSION_LABELS = [
  ["Cleanliness", "ratingCleanliness"],
  ["Accuracy", "ratingAccuracy"],
  ["Communication", "ratingCommunication"],
  ["Location", "ratingLocation"],
  ["Value", "ratingValue"],
] as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function AdminReviewCard({ review }: { review: AdminReviewItem }) {
  const router = useRouter();
  const [response, setResponse] = React.useState(review.hostResponse ?? "");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [editingResponse, setEditingResponse] = React.useState(!review.hostResponse);

  async function patch(body: { isPublished?: boolean; hostResponse?: string | null }) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reviews/${review.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not update review.");
        setSubmitting(false);
        return;
      }
      router.refresh();
      setSubmitting(false);
      if (body.hostResponse !== undefined) setEditingResponse(false);
    } catch {
      setError("Network error.");
      setSubmitting(false);
    }
  }

  return (
    <article className="rounded-2xl border border-neutral-200 bg-white p-5">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-neutral-900">{review.guestName}</p>
          <p className="text-xs text-neutral-500">
            {review.guestEmail} · {formatDate(review.createdAtISO)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xl text-amber-500" aria-hidden>
            ★
          </span>
          <span className="text-lg font-semibold">{review.ratingOverall.toFixed(1)} / 5</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              review.isPublished
                ? "bg-emerald-100 text-emerald-900"
                : "bg-neutral-200 text-neutral-700"
            }`}
          >
            {review.isPublished ? "Published" : "Hidden"}
          </span>
        </div>
      </header>

      <dl className="mb-3 grid grid-cols-2 gap-1 text-xs text-neutral-600 sm:grid-cols-5">
        {DIMENSION_LABELS.map(([label, key]) => (
          <div key={key}>
            <dt className="text-neutral-500">{label}</dt>
            <dd className="font-medium text-neutral-900">
              {(review[key] as number).toFixed(1)}
            </dd>
          </div>
        ))}
      </dl>

      {review.reviewText && (
        <p className="mb-3 whitespace-pre-line rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
          {review.reviewText}
        </p>
      )}

      {/* Host response section */}
      {!editingResponse && review.hostResponse ? (
        <div className="mb-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Your response
          </p>
          <p className="mt-1 whitespace-pre-line text-sm text-neutral-700">
            {review.hostResponse}
          </p>
          {review.hostRespondedAtISO && (
            <p className="mt-1 text-xs text-neutral-500">
              {formatDate(review.hostRespondedAtISO)}
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingResponse(true)}
            >
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => patch({ hostResponse: null })}
              disabled={submitting}
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="mb-3">
          <label className="text-xs font-medium text-neutral-700">
            Public response{" "}
            <span className="font-normal text-neutral-500">(optional)</span>
          </label>
          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            rows={3}
            maxLength={2000}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              onClick={() => patch({ hostResponse: response })}
              disabled={submitting || response.trim().length === 0}
            >
              {submitting ? "Saving…" : "Save response"}
            </Button>
            {review.hostResponse && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setResponse(review.hostResponse ?? "");
                  setEditingResponse(false);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-neutral-200 pt-3">
        <a
          href={review.bookingHref}
          className="text-xs font-medium text-neutral-600 underline-offset-4 hover:text-neutral-900 hover:underline"
        >
          View booking
        </a>
        <Button
          size="sm"
          variant="outline"
          onClick={() => patch({ isPublished: !review.isPublished })}
          disabled={submitting}
        >
          {review.isPublished ? "Unpublish" : "Publish"}
        </Button>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </article>
  );
}
