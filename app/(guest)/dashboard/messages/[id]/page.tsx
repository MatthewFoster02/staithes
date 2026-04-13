import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/server";
import {
  readThread,
  MessagingForbiddenError,
  MessagingNotFoundError,
} from "@/lib/messaging/threads";
import { ThreadView, type ThreadViewMessage } from "@/components/messaging/thread-view";

export const metadata: Metadata = {
  title: "Conversation",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GuestThreadPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/dashboard/messages/${id}`);

  let thread;
  try {
    thread = await readThread(id, { kind: "guest", guestId: user.id });
  } catch (err) {
    if (err instanceof MessagingForbiddenError || err instanceof MessagingNotFoundError) {
      notFound();
    }
    throw err;
  }

  const viewMessages: ThreadViewMessage[] = thread.messages.map((m) => ({
    id: m.id,
    senderType: m.senderType,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link
        href="/dashboard/messages"
        className="mb-6 inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900"
      >
        <ArrowLeftIcon className="size-4" />
        All messages
      </Link>

      <header className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight">
          {thread.subject ?? "Conversation with the host"}
        </h1>
      </header>

      <ThreadView
        threadId={thread.id}
        messages={viewMessages}
        mySide="guest"
        postUrl={`/api/messages/threads/${thread.id}`}
        canSend={thread.status === "open"}
      />
    </article>
  );
}
