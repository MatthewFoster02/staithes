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
import { MessageCircle } from "lucide-react";

interface Props {
  /** Whether the current visitor is signed in. Drives the click target. */
  isSignedIn: boolean;
}

export function ContactHostButton({ isSignedIn }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [content, setContent] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sentThreadId, setSentThreadId] = React.useState<string | null>(null);

  // Not signed in: render a plain link to /login. Same visual as
  // the open-modal button so the property page layout is consistent.
  if (!isSignedIn) {
    return (
      <a
        href="/login?next=/"
        className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50"
      >
        <MessageCircle className="size-4" />
        Sign in to message the host
      </a>
    );
  }

  function reset() {
    setContent("");
    setError(null);
    setSentThreadId(null);
    setSubmitting(false);
  }

  async function submit() {
    const trimmed = content.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/messages/threads", {
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
      setSentThreadId(data.threadId);
      router.refresh();
      setSubmitting(false);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" className="gap-2">
            <MessageCircle className="size-4" />
            Message the host
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Message the host</DialogTitle>
          <DialogDescription>
            Have a question before you book? The host will reply by email and
            in your dashboard.
          </DialogDescription>
        </DialogHeader>
        {sentThreadId ? (
          <div className="space-y-4">
            <p className="text-sm text-neutral-700">
              Message sent. The host will reply soon — check your dashboard for
              the conversation.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button onClick={() => (window.location.href = `/dashboard/messages/${sentThreadId}`)}>
                Open conversation
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              maxLength={4000}
              placeholder="Hi! Quick question about the property…"
              className="w-full resize-none rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={submitting || content.trim().length === 0}>
                {submitting ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
