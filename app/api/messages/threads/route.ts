import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import {
  getOrCreateThread,
  listThreadsForGuest,
  listThreadsForHost,
  sendMessage,
  MessagingForbiddenError,
  MessagingNotFoundError,
} from "@/lib/messaging/threads";
import { resolveViewer } from "@/lib/messaging/auth";

export const dynamic = "force-dynamic";

// GET — list threads for the current viewer. Auto-routes between
// guest and host based on auth.
export async function GET() {
  const auth = await resolveViewer();
  if (!auth.ok) return auth.response;

  if (auth.viewer.kind === "host") {
    const property = await prisma.property.findFirst({ select: { id: true } });
    if (!property) return NextResponse.json({ threads: [] });
    const threads = await listThreadsForHost(property.id);
    return NextResponse.json({ threads });
  }

  const threads = await listThreadsForGuest(auth.viewer.guestId);
  return NextResponse.json({ threads });
}

const CreateBodySchema = z.object({
  subject: z.string().max(200).optional(),
  content: z.string().min(1).max(4000),
  bookingId: z.string().uuid().optional(),
});

// POST — guest creates (or reuses) a thread and posts the first
// message in one shot. The host doesn't initiate threads from this
// endpoint — they always reply to one the guest started.
export async function POST(request: Request) {
  const auth = await resolveViewer();
  if (!auth.ok) return auth.response;
  if (auth.viewer.kind !== "guest") {
    return NextResponse.json(
      { error: "Hosts can't initiate threads — reply on the guest's thread instead." },
      { status: 403 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = CreateBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const property = await prisma.property.findFirst({ select: { id: true } });
  if (!property) {
    return NextResponse.json({ error: "No property configured" }, { status: 404 });
  }

  // If a bookingId is provided, verify it actually belongs to this guest.
  if (parsed.data.bookingId) {
    const booking = await prisma.booking.findUnique({
      where: { id: parsed.data.bookingId },
      select: { guestId: true },
    });
    if (!booking || booking.guestId !== auth.viewer.guestId) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
  }

  try {
    const thread = await getOrCreateThread({
      propertyId: property.id,
      guestId: auth.viewer.guestId,
      bookingId: parsed.data.bookingId,
      subject: parsed.data.subject,
    });
    await sendMessage({
      threadId: thread.id,
      content: parsed.data.content,
      viewer: auth.viewer,
    });
    return NextResponse.json({ threadId: thread.id });
  } catch (err) {
    if (err instanceof MessagingForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof MessagingNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
}
