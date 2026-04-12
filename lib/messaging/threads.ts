import { prisma } from "@/lib/db/prisma";
import type {
  MessageSenderType,
  MessageThreadStatus,
  Prisma,
} from "@/lib/generated/prisma/client";

// ---------------------------------------------------------------------------
// Viewer model
// ---------------------------------------------------------------------------

// Every service function takes a `viewer` so it can verify ownership
// without round-tripping back to the route layer. The viewer is one
// of: a signed-in guest, or "the host". The host doesn't have a row
// in the guests table — they're identified by being on the HOST_EMAILS
// list at the route boundary, and the route passes `{ kind: "host" }`
// in.
export type Viewer =
  | { kind: "guest"; guestId: string }
  | { kind: "host" };

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class MessagingForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
  }
}

export class MessagingNotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Thread previews used by list endpoints
// ---------------------------------------------------------------------------

export interface ThreadPreview {
  id: string;
  subject: string | null;
  status: MessageThreadStatus;
  bookingId: string | null;
  updatedAt: Date;
  guest: { id: string; firstName: string; lastName: string; email: string };
  lastMessage: {
    senderType: MessageSenderType;
    content: string;
    createdAt: Date;
  } | null;
  unreadCount: number;
}

// ---------------------------------------------------------------------------
// getOrCreateThread
// ---------------------------------------------------------------------------

interface GetOrCreateArgs {
  propertyId: string;
  guestId: string;
  bookingId?: string | null;
  subject?: string | null;
}

// Finds an existing thread for the (booking) pair, or for the
// (guest, no booking) open enquiry pair, or creates one. Booking-tied
// threads are uniquely keyed on bookingId; pre-booking enquiries
// reuse the most recent open thread for the same guest+property so
// the host doesn't get a new thread for every "is the wifi fast?".
export async function getOrCreateThread(
  args: GetOrCreateArgs,
): Promise<{ id: string; created: boolean }> {
  if (args.bookingId) {
    const existing = await prisma.messageThread.findUnique({
      where: { bookingId: args.bookingId },
      select: { id: true },
    });
    if (existing) return { id: existing.id, created: false };
    const created = await prisma.messageThread.create({
      data: {
        propertyId: args.propertyId,
        guestId: args.guestId,
        bookingId: args.bookingId,
        subject: args.subject ?? null,
      },
    });
    return { id: created.id, created: true };
  }

  // Pre-booking enquiry: reuse the latest OPEN thread for this guest
  // on this property if one exists.
  const existing = await prisma.messageThread.findFirst({
    where: {
      propertyId: args.propertyId,
      guestId: args.guestId,
      bookingId: null,
      status: "open",
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  const created = await prisma.messageThread.create({
    data: {
      propertyId: args.propertyId,
      guestId: args.guestId,
      subject: args.subject ?? null,
    },
  });
  return { id: created.id, created: true };
}

// ---------------------------------------------------------------------------
// listThreadsForGuest / listThreadsForHost
// ---------------------------------------------------------------------------

async function listThreads(
  where: Prisma.MessageThreadWhereInput,
  viewer: Viewer,
): Promise<ThreadPreview[]> {
  const threads = await prisma.messageThread.findMany({
    where,
    include: {
      guest: { select: { id: true, firstName: true, lastName: true, email: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { senderType: true, content: true, createdAt: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Unread count: messages from the OTHER side of the conversation
  // that haven't been read yet. We compute this in a second batched
  // query keyed by threadId so listing N threads is one extra round-trip
  // rather than N+1.
  const otherSenderTypes: MessageSenderType[] =
    viewer.kind === "guest" ? ["host", "system"] : ["guest"];

  const unreadGroups = await prisma.message.groupBy({
    by: ["threadId"],
    where: {
      threadId: { in: threads.map((t) => t.id) },
      isRead: false,
      senderType: { in: otherSenderTypes },
    },
    _count: { _all: true },
  });

  const unreadByThread = new Map<string, number>();
  for (const group of unreadGroups) {
    unreadByThread.set(group.threadId, group._count._all);
  }

  return threads.map((t) => ({
    id: t.id,
    subject: t.subject,
    status: t.status,
    bookingId: t.bookingId,
    updatedAt: t.updatedAt,
    guest: t.guest,
    lastMessage: t.messages[0] ?? null,
    unreadCount: unreadByThread.get(t.id) ?? 0,
  }));
}

export async function listThreadsForGuest(guestId: string): Promise<ThreadPreview[]> {
  return listThreads({ guestId }, { kind: "guest", guestId });
}

export async function listThreadsForHost(
  propertyId: string,
  status?: MessageThreadStatus,
): Promise<ThreadPreview[]> {
  const where: Prisma.MessageThreadWhereInput = { propertyId };
  if (status) where.status = status;
  return listThreads(where, { kind: "host" });
}

// ---------------------------------------------------------------------------
// Thread detail + message read
// ---------------------------------------------------------------------------

export interface ThreadDetail {
  id: string;
  subject: string | null;
  status: MessageThreadStatus;
  bookingId: string | null;
  guest: { id: string; firstName: string; lastName: string; email: string };
  messages: {
    id: string;
    senderType: MessageSenderType;
    senderId: string | null;
    content: string;
    createdAt: Date;
    isRead: boolean;
  }[];
}

// Loads a thread with its messages and atomically flips the read flag
// on messages from the OTHER side. Throws Forbidden / NotFound which
// the route layer maps to status codes.
export async function readThread(threadId: string, viewer: Viewer): Promise<ThreadDetail> {
  const thread = await prisma.messageThread.findUnique({
    where: { id: threadId },
    include: {
      guest: { select: { id: true, firstName: true, lastName: true, email: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!thread) throw new MessagingNotFoundError();
  assertCanAccess(thread, viewer);

  // Mark unread "other side" messages as read.
  const otherSenderTypes: MessageSenderType[] =
    viewer.kind === "guest" ? ["host", "system"] : ["guest"];
  await prisma.message.updateMany({
    where: {
      threadId,
      isRead: false,
      senderType: { in: otherSenderTypes },
    },
    data: { isRead: true },
  });

  return {
    id: thread.id,
    subject: thread.subject,
    status: thread.status,
    bookingId: thread.bookingId,
    guest: thread.guest,
    messages: thread.messages.map((m) => ({
      id: m.id,
      senderType: m.senderType,
      senderId: m.senderId,
      content: m.content,
      createdAt: m.createdAt,
      // Reflect the just-applied read flip in the response so the
      // client doesn't show stale unread badges.
      isRead:
        m.isRead ||
        (otherSenderTypes.includes(m.senderType) ? true : m.isRead),
    })),
  };
}

// ---------------------------------------------------------------------------
// sendMessage
// ---------------------------------------------------------------------------

interface SendMessageArgs {
  threadId: string;
  content: string;
  viewer: Viewer;
}

export async function sendMessage(args: SendMessageArgs) {
  const content = args.content.trim();
  if (!content) {
    throw new Error("Message content is required");
  }

  return prisma.$transaction(async (tx) => {
    const thread = await tx.messageThread.findUnique({
      where: { id: args.threadId },
      select: { id: true, guestId: true, propertyId: true, status: true },
    });
    if (!thread) throw new MessagingNotFoundError();
    assertCanAccess(thread, args.viewer);
    if (thread.status !== "open") {
      throw new MessagingForbiddenError("Thread is not open");
    }

    const senderType: MessageSenderType = args.viewer.kind === "host" ? "host" : "guest";
    const senderId = args.viewer.kind === "guest" ? args.viewer.guestId : null;

    const message = await tx.message.create({
      data: {
        threadId: args.threadId,
        senderType,
        senderId,
        content,
        isRead: false,
      },
    });

    // Bump the thread's updatedAt so it sorts to the top of inboxes.
    // Prisma's @updatedAt only fires when at least one field is set,
    // so write a no-op-ish status touch. Using a real status avoids
    // a "no fields to update" error.
    await tx.messageThread.update({
      where: { id: args.threadId },
      data: { status: "open" },
    });

    return message;
  });
}

// ---------------------------------------------------------------------------
// Status changes (host only)
// ---------------------------------------------------------------------------

export async function setThreadStatus(
  threadId: string,
  status: MessageThreadStatus,
  viewer: Viewer,
): Promise<void> {
  if (viewer.kind !== "host") throw new MessagingForbiddenError();

  const thread = await prisma.messageThread.findUnique({
    where: { id: threadId },
    select: { id: true },
  });
  if (!thread) throw new MessagingNotFoundError();

  await prisma.messageThread.update({
    where: { id: threadId },
    data: { status },
  });
}

// ---------------------------------------------------------------------------
// Internal access guard
// ---------------------------------------------------------------------------

function assertCanAccess(
  thread: { guestId: string },
  viewer: Viewer,
): void {
  if (viewer.kind === "host") return;
  if (thread.guestId !== viewer.guestId) {
    throw new MessagingForbiddenError();
  }
}
