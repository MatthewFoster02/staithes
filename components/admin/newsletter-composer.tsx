"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const MIN_BODY_LENGTH = 20;

// Composer for marketing newsletters. Plain markdown body; the server
// renders it into a React Email template before sending. Two-step
// confirm because newsletters are irreversible — once it's gone to
// 200 inboxes there's no taking it back.
export function NewsletterComposer({ recipientCount }: { recipientCount: number }) {
  const router = useRouter();
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [confirming, setConfirming] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{ success: number; failure: number } | null>(null);

  const ready = subject.trim().length >= 3 && body.trim().length >= MIN_BODY_LENGTH;

  async function send() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/newsletter/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), bodyMarkdown: body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not send newsletter.");
        setSubmitting(false);
        setConfirming(false);
        return;
      }
      setResult({ success: data.successCount ?? 0, failure: data.failureCount ?? 0 });
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
      setConfirming(false);
    }
  }

  if (result) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <h2 className="text-base font-semibold text-emerald-900">Newsletter sent</h2>
        <p className="mt-2 text-sm text-neutral-700">
          Delivered to {result.success} guest{result.success === 1 ? "" : "s"}.
          {result.failure > 0 && (
            <>
              {" "}
              <span className="text-red-600">
                {result.failure} send{result.failure === 1 ? "" : "s"} failed
              </span>{" "}
              — check the Resend dashboard for details.
            </>
          )}
        </p>
        <div className="mt-4">
          <Button
            variant="outline"
            onClick={() => {
              setResult(null);
              setSubject("");
              setBody("");
            }}
          >
            Compose another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5">
      <label className="block">
        <span className="text-sm font-medium text-neutral-700">Subject</span>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          placeholder="A new season at Staithes"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-neutral-700">Message</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
          maxLength={10000}
          placeholder="Hi there,&#10;&#10;Spring availability has just opened up…"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-mono"
        />
        <span className="mt-1 block text-xs text-neutral-500">
          Plain text or markdown — links use [text](url), bold uses **bold**.
        </span>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {confirming ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-medium text-amber-900">
            Send to {recipientCount} guest{recipientCount === 1 ? "" : "s"}?
          </p>
          <p className="mt-1 text-neutral-700">
            This is irreversible. Once sent, you can&rsquo;t recall the email.
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirming(false)}
              disabled={submitting}
            >
              Back to edit
            </Button>
            <Button onClick={send} disabled={submitting}>
              {submitting ? "Sending…" : `Send to ${recipientCount}`}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button
            onClick={() => setConfirming(true)}
            disabled={!ready || recipientCount === 0}
          >
            {recipientCount === 0 ? "No recipients" : "Review and send"}
          </Button>
        </div>
      )}
    </div>
  );
}
