import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { resolveViewer } from "@/lib/messaging/auth";

export const dynamic = "force-dynamic";

// Returns the unread message count for the current viewer.
// Polled by the LiveUnreadBadge client component every 15 seconds
// so the header badge stays roughly in sync without a full Realtime
// subscription. The badge initial value still comes from SSR so a
// page load is instant; this just keeps it fresh thereafter.
export async function GET() {
  const auth = await resolveViewer();
  if (!auth.ok) return NextResponse.json({ count: 0 });

  if (auth.viewer.kind === "host") {
    const count = await prisma.message.count({
      where: { isRead: false, senderType: "guest" },
    });
    return NextResponse.json({ count });
  }

  const count = await prisma.message.count({
    where: {
      isRead: false,
      senderType: { in: ["host", "system"] },
      thread: { guestId: auth.viewer.guestId },
    },
  });
  return NextResponse.json({ count });
}
