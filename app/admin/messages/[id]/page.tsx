import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import {
  readThread,
  MessagingForbiddenError,
  MessagingNotFoundError,
} from "@/lib/messaging/threads";
import { ThreadView, type ThreadViewMessage } from "@/components/messaging/thread-view";
import { prisma } from "@/lib/db/prisma";
import { formatISODate } from "@/lib/availability/dates";

export const metadata: Metadata = {
  title: "Admin · Conversation",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminThreadPage({ params }: PageProps) {
  const { id } = await params;

  let thread;
  try {
    thread = await readThread(id, { kind: "host" });
  } catch (err) {
    if (err instanceof MessagingForbiddenError || err instanceof MessagingNotFoundError) {
      notFound();
    }
    throw err;
  }

  // If the thread is tied to a booking, fetch a small summary so the
  // host has context inline rather than having to bounce out to the
  // booking detail page.
  const booking = thread.bookingId
    ? await prisma.booking.findUnique({
        where: { id: thread.bookingId },
        select: {
          id: true,
          checkIn: true,
          checkOut: true,
          status: true,
          totalPrice: true,
          currency: true,
        },
      })
    : null;

  const viewMessages: ThreadViewMessage[] = thread.messages.map((m) => ({
    id: m.id,
    senderType: m.senderType,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <article className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/admin/messages"
        className="mb-6 inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900"
      >
        <ArrowLeftIcon className="size-4" />
        All messages
      </Link>

      <header className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight">
          {thread.guest.firstName} {thread.guest.lastName}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">{thread.guest.email}</p>
      </header>

      {booking && (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Linked booking
            </p>
            <p className="mt-0.5 text-neutral-900">
              {formatISODate(booking.checkIn)} → {formatISODate(booking.checkOut)} ·{" "}
              <span className="capitalize">{booking.status}</span>
            </p>
          </div>
          <Link
            href={`/admin/bookings/${booking.id}`}
            className="text-xs font-medium text-neutral-900 underline-offset-4 hover:underline"
          >
            Open booking
          </Link>
        </div>
      )}

      <ThreadView
        threadId={thread.id}
        messages={viewMessages}
        mySide="host"
        postUrl={`/api/messages/threads/${thread.id}`}
        canSend={thread.status === "open"}
      />
    </article>
  );
}
