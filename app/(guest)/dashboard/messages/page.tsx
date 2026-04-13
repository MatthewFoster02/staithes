import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { listThreadsForGuest } from "@/lib/messaging/threads";
import { ThreadList } from "@/components/messaging/thread-list";

export const metadata: Metadata = {
  title: "Messages",
};

export default async function GuestMessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/messages");

  const threads = await listThreadsForGuest(user.id);

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Messages</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Conversations with the host about your stay or any questions.
        </p>
      </header>

      <ThreadList
        threads={threads}
        hrefFor={(id) => `/dashboard/messages/${id}`}
        otherPartyName={() => "Host"}
        emptyMessage="No messages yet. Send the host a question from the property page or your booking detail."
      />
    </article>
  );
}
