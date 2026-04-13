import Link from "next/link";
import type { ThreadPreview } from "@/lib/messaging/threads";

interface ThreadListProps {
  threads: ThreadPreview[];
  /** Function returning the href for a given thread id. */
  hrefFor: (threadId: string) => string;
  /** What to call the OTHER side of the conversation in each row. */
  otherPartyName: (thread: ThreadPreview) => string;
  emptyMessage: string;
}

const ABSOLUTE_DAY_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 60 * 60_000) {
    const m = Math.round(diff / 60_000);
    return `${m}m ago`;
  }
  if (diff < 24 * 60 * 60_000) {
    const h = Math.round(diff / (60 * 60_000));
    return `${h}h ago`;
  }
  if (diff < ABSOLUTE_DAY_THRESHOLD_MS) {
    const d = Math.round(diff / (24 * 60 * 60_000));
    return `${d}d ago`;
  }
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function ThreadList({ threads, hrefFor, otherPartyName, emptyMessage }: ThreadListProps) {
  if (threads.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center text-sm text-neutral-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
      {threads.map((t) => (
        <li key={t.id}>
          <Link
            href={hrefFor(t.id)}
            className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-neutral-50"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium text-neutral-900">
                  {otherPartyName(t)}
                </p>
                {t.unreadCount > 0 && (
                  <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-semibold text-white">
                    {t.unreadCount}
                  </span>
                )}
              </div>
              {t.lastMessage && (
                <p className="mt-1 truncate text-sm text-neutral-600">
                  {t.lastMessage.senderType === "host" && (
                    <span className="text-neutral-500">Host: </span>
                  )}
                  {t.lastMessage.senderType === "system" && (
                    <span className="text-neutral-500">System: </span>
                  )}
                  {t.lastMessage.content}
                </p>
              )}
            </div>
            <span className="shrink-0 text-xs text-neutral-500">
              {formatRelative(t.updatedAt)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
