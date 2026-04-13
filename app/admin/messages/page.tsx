import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { listThreadsForHost } from "@/lib/messaging/threads";
import { ThreadList } from "@/components/messaging/thread-list";

export const metadata: Metadata = {
  title: "Admin · Messages",
};

export default async function AdminMessagesPage() {
  const property = await prisma.property.findFirst({ select: { id: true } });
  const threads = property ? await listThreadsForHost(property.id) : [];

  return (
    <article className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Messages</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Conversations with guests — pre-booking enquiries and post-booking
          coordination all live here.
        </p>
      </header>

      <ThreadList
        threads={threads}
        hrefFor={(id) => `/admin/messages/${id}`}
        otherPartyName={(t) => `${t.guest.firstName} ${t.guest.lastName}`}
        emptyMessage="No messages yet. When guests message you they'll appear here."
      />
    </article>
  );
}
