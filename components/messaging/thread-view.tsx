"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { MessageSenderType } from "@/lib/generated/prisma/client";
import { Button } from "@/components/ui/button";

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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ThreadView({ messages, mySide, postUrl, canSend }: ThreadViewProps) {
  const router = useRouter();
  const [content, setContent] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  // Scroll to bottom on mount + whenever the message list grows.
  React.useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

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
      setContent("");
      router.refresh();
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
