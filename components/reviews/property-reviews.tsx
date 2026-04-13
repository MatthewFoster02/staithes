interface ReviewSummaryRow {
  id: string;
  guestFirstName: string;
  guestLastInitial: string;
  ratingOverall: number;
  reviewText: string | null;
  hostResponse: string | null;
  createdAt: Date;
}

interface Props {
  averageOverall: number | null;
  count: number;
  reviews: ReviewSummaryRow[];
}

function StarBar({ value }: { value: number }) {
  const filled = Math.round(value);
  return (
    <span aria-label={`${value} out of 5`} className="inline-flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`text-base leading-none ${n <= filled ? "text-amber-500" : "text-neutral-300"}`}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function PropertyReviews({ averageOverall, count, reviews }: Props) {
  if (count === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
        No reviews yet. Be the first to stay and tell us how it went.
      </div>
    );
  }

  return (
    <div>
      {averageOverall !== null && (
        <div className="mb-6 flex items-center gap-3">
          <div>
            <p className="text-3xl font-semibold tracking-tight">
              {averageOverall.toFixed(1)}{" "}
              <span className="text-base font-normal text-neutral-500">/ 5</span>
            </p>
            <p className="text-sm text-neutral-500">
              {count} {count === 1 ? "review" : "reviews"}
            </p>
          </div>
        </div>
      )}

      <ul className="grid gap-4 sm:grid-cols-2">
        {reviews.map((r) => (
          <li
            key={r.id}
            className="rounded-2xl border border-neutral-200 bg-white p-5"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="font-medium text-neutral-900">
                {r.guestFirstName} {r.guestLastInitial}.
              </p>
              <StarBar value={r.ratingOverall} />
            </div>
            <p className="text-xs text-neutral-500">{formatDate(r.createdAt)}</p>
            {r.reviewText && (
              <p className="mt-3 whitespace-pre-line text-sm text-neutral-700">
                {r.reviewText}
              </p>
            )}
            {r.hostResponse && (
              <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Host response
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-neutral-700">
                  {r.hostResponse}
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
