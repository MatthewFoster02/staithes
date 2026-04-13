"use client";

import * as React from "react";

interface Props {
  /** Initial count from SSR so the badge is correct on first paint. */
  initialCount: number;
  /** Tailwind class for the dot colour — green on guest, orange on host etc. */
  colorClass?: string;
}

const POLL_INTERVAL_MS = 15_000;

// Polls /api/messages/unread-count on a fixed interval. Realtime
// would be nicer but the badge would need to know the viewer's
// thread ids to filter inserts, which means duplicating the API's
// auth logic on the client. Polling every 15s is two orders of
// magnitude cheaper to implement and the staleness is invisible
// to a human user.
export function LiveUnreadBadge({
  initialCount,
  colorClass = "bg-emerald-600",
}: Props) {
  const [count, setCount] = React.useState(initialCount);

  React.useEffect(() => {
    let cancelled = false;

    async function fetchCount() {
      try {
        const res = await fetch("/api/messages/unread-count", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setCount(typeof data.count === "number" ? data.count : 0);
      } catch {
        // Network blip — leave the previous count and try again next tick.
      }
    }

    const id = window.setInterval(fetchCount, POLL_INTERVAL_MS);
    // Refresh immediately on tab refocus so users coming back to the
    // tab after a while see a current count.
    function onFocus() {
      fetchCount();
    }
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  if (count <= 0) return null;
  return (
    <span
      className={`absolute -top-2 -right-3 inline-flex min-w-[1.1rem] items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white ${colorClass}`}
    >
      {count}
    </span>
  );
}
