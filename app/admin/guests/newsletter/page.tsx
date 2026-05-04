import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { NewsletterComposer } from "@/components/admin/newsletter-composer";

export const metadata: Metadata = {
  title: "Admin · Newsletter",
};

export default async function AdminNewsletterPage() {
  const [optedInCount, recentSends] = await Promise.all([
    prisma.guest.count({ where: { marketingOptIn: true } }),
    prisma.newsletterSend.findMany({ orderBy: { sentAt: "desc" }, take: 5 }),
  ]);

  return (
    <article className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/admin/guests"
        className="mb-6 inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900"
      >
        <ArrowLeftIcon className="size-4" />
        Back to guests
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Send newsletter</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Goes out to <strong>{optedInCount}</strong> opted-in guest
          {optedInCount === 1 ? "" : "s"}. Every email gets a one-click
          unsubscribe link in the footer.
        </p>
      </header>

      <NewsletterComposer recipientCount={optedInCount} />

      {recentSends.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Recent sends
          </h2>
          <ul className="space-y-2 rounded-2xl border border-neutral-200 bg-white">
            {recentSends.map((send) => (
              <li key={send.id} className="flex items-center justify-between border-b border-neutral-100 p-4 last:border-b-0">
                <div className="min-w-0">
                  <p className="font-medium text-neutral-900">{send.subject}</p>
                  <p className="text-xs text-neutral-500">
                    Sent {send.sentAt.toLocaleString("en-GB")}
                  </p>
                </div>
                <p className="text-sm text-neutral-700 tabular-nums">
                  {send.successCount} sent
                  {send.failureCount > 0 && (
                    <span className="ml-2 text-red-600">{send.failureCount} failed</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
