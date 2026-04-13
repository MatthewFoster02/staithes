"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { MessageSenderType } from "@/lib/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/auth/browser";

export interface ThreadViewMessage {
  id: string;
  senderType: MessageSenderType;
  content: string;
  createdAt: string; // ISO
}

interface ThreadViewProps {
  threadId: string;
  messages: ThreadViewMessage[];
  /**
   * What "you" are in this conversation. The chat lays out
   * `mySide` messages on the right and everything else on the left.
   */
  mySide: MessageSenderType;
  /** Endpoint to POST a new message to. */
  postUrl: string;
  /** Whether the thread is open and can accept new messages. */
  canSend: boolean;
}

// Shape of the postgres_changes payload for a `messages` insert.
// We only pull the columns we render so the cast can be loose.
interface RealtimeMessageRow {
  id: string;
  thread_id: string;
  sender_type: MessageSenderType;
  content: string;
  created_at: string;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ThreadView({ threadId, messages: initialMessages, mySide, postUrl, canSend }: ThreadViewProps) {
  const router = useRouter();
  const [messages, setMessages] = React.useState<ThreadViewMessage[]>(initialMessages);
  const [content, setContent] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  // Re-sync local state when the parent re-renders with new initial
  // messages (e.g., after a router.refresh() following navigation).
  React.useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  // Scroll to bottom on mount + whenever the message list grows.
  React.useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  // Realtime subscription: append any new message inserted on this
  // thread, deduping by id so optimistic locally-added messages and
  // realtime-echoed messages don't show up twice.
  React.useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`thread:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload: { new: RealtimeMessageRow }) => {
          const row = payload.new;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [
              ...prev,
              {
                id: row.id,
                senderType: row.sender_type,
                content: row.content,
                createdAt: row.created_at,
              },
            ];
          });
          // Trigger a server-side refetch so the read-marker side
          // effect runs (readThread flips isRead). Cheap call, fine.
          router.refresh();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not send message.");
        setSubmitting(false);
        return;
      }
      // Optimistically append our own message so the sender sees it
      // without waiting for the realtime echo round-trip. The
      // dedup-by-id guard in the realtime handler stops it appearing
      // twice when the broadcast lands.
      if (data.messageId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.messageId)) return prev;
          return [
            ...prev,
            {
              id: data.messageId,
              senderType: mySide,
              content: trimmed,
              createdAt: new Date().toISOString(),
            },
          ];
        });
      }
      setContent("");
      setSubmitting(false);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col rounded-2xl border border-neutral-200 bg-white">
      <div
        ref={scrollRef}
        className="flex h-96 flex-col gap-3 overflow-y-auto p-5"
      >
        {messages.length === 0 ? (
          <p className="m-auto text-sm text-neutral-500">No messages yet.</p>
        ) : (
          messages.map((m) => {
            const isMine = m.senderType === mySide;
            const isSystem = m.senderType === "system";
            if (isSystem) {
              return (
                <div key={m.id} className="mx-auto max-w-md text-center">
                  <p className="text-xs italic text-neutral-500">{m.content}</p>
                  <p className="mt-0.5 text-[10px] text-neutral-400">
                    {formatTime(m.createdAt)}
                  </p>
                </div>
              );
            }
            return (
              <div
                key={m.id}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[75%] ${isMine ? "items-end" : "items-start"} flex flex-col`}>
                  <div
                    className={`whitespace-pre-line rounded-2xl px-4 py-2 text-sm ${
                      isMine
                        ? "bg-emerald-600 text-white"
                        : "bg-neutral-100 text-neutral-900"
                    }`}
                  >
                    {m.content}
                  </div>
                  <p className="mt-1 text-[10px] text-neutral-500">
                    {formatTime(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {canSend ? (
        <form onSubmit={handleSubmit} className="border-t border-neutral-200 p-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write a message…"
            rows={2}
            maxLength={4000}
            className="w-full resize-none rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          <div className="mt-2 flex justify-end">
            <Button type="submit" disabled={submitting || content.trim().length === 0}>
              {submitting ? "Sending…" : "Send"}
            </Button>
          </div>
        </form>
      ) : (
        <p className="border-t border-neutral-200 px-5 py-4 text-center text-xs text-neutral-500">
          This thread is closed.
        </p>
      )}
    </div>
  );
}
