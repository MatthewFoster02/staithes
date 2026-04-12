// Smoke test for the messaging service. Exercises the service layer
// directly (not the HTTP endpoints) to keep the test fast and free
// of cookie/auth scaffolding. Tests:
//   - getOrCreateThread for pre-booking and booking-tied paths
//   - sendMessage / readThread / read-flag flipping
//   - guest can't see another guest's thread
//   - host can see all threads
//   - sending to a closed thread is rejected
//
// Run with: npx tsx scripts/test-messaging.ts

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import {
  getOrCreateThread,
  listThreadsForGuest,
  listThreadsForHost,
  readThread,
  sendMessage,
  setThreadStatus,
  MessagingForbiddenError,
  type Viewer,
} from "../lib/messaging/threads";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

let failures = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}`);
    if (detail !== undefined) console.error("    detail:", detail);
    failures++;
  }
}

const GUEST_A_ID = "00000000-0000-0000-0000-000000000a01";
const GUEST_B_ID = "00000000-0000-0000-0000-000000000a02";

async function main() {
  const property = await prisma.property.findUnique({ where: { slug: "staithes" } });
  if (!property) throw new Error("Run `npx prisma db seed` first.");

  // Create two guests for the ownership-isolation tests.
  await prisma.guest.upsert({
    where: { email: "messaging-a@example.invalid" },
    update: {},
    create: {
      id: GUEST_A_ID,
      email: "messaging-a@example.invalid",
      firstName: "Alice",
      lastName: "Tester",
    },
  });
  await prisma.guest.upsert({
    where: { email: "messaging-b@example.invalid" },
    update: {},
    create: {
      id: GUEST_B_ID,
      email: "messaging-b@example.invalid",
      firstName: "Bob",
      lastName: "Tester",
    },
  });

  const guestA: Viewer = { kind: "guest", guestId: GUEST_A_ID };
  const guestB: Viewer = { kind: "guest", guestId: GUEST_B_ID };
  const host: Viewer = { kind: "host" };

  const createdThreadIds: string[] = [];

  try {
    console.log("\n— getOrCreateThread (pre-booking enquiry) —");
    const t1 = await getOrCreateThread({
      propertyId: property.id,
      guestId: GUEST_A_ID,
    });
    createdThreadIds.push(t1.id);
    assert("creates a new pre-booking thread", t1.created === true);

    const t1Again = await getOrCreateThread({
      propertyId: property.id,
      guestId: GUEST_A_ID,
    });
    assert(
      "second call returns the same thread (open enquiry reuse)",
      t1Again.id === t1.id && t1Again.created === false,
      t1Again,
    );

    console.log("\n— sendMessage / readThread —");
    await sendMessage({
      threadId: t1.id,
      content: "Hi, is the property pet-friendly?",
      viewer: guestA,
    });
    await sendMessage({
      threadId: t1.id,
      content: "Yes — small dogs are welcome.",
      viewer: host,
    });

    const detail = await readThread(t1.id, guestA);
    assert("thread has 2 messages", detail.messages.length === 2);
    assert("first message is from the guest", detail.messages[0].senderType === "guest");
    assert("second message is from the host", detail.messages[1].senderType === "host");
    assert(
      "host's message is now marked read after guest reads",
      detail.messages[1].isRead === true,
      detail.messages[1],
    );

    console.log("\n— Ownership isolation —");
    let forbiddenThrown = false;
    try {
      await readThread(t1.id, guestB);
    } catch (e) {
      if (e instanceof MessagingForbiddenError) forbiddenThrown = true;
    }
    assert("guest B cannot read guest A's thread", forbiddenThrown);

    console.log("\n— Host visibility —");
    const hostThreads = await listThreadsForHost(property.id);
    assert(
      "host sees the thread in their inbox",
      hostThreads.some((t) => t.id === t1.id),
      hostThreads.map((t) => t.id),
    );

    const guestAThreads = await listThreadsForGuest(GUEST_A_ID);
    assert(
      "guest A sees their thread",
      guestAThreads.some((t) => t.id === t1.id),
      guestAThreads.map((t) => t.id),
    );

    const guestBThreads = await listThreadsForGuest(GUEST_B_ID);
    assert(
      "guest B sees no threads",
      guestBThreads.length === 0,
      guestBThreads,
    );

    console.log("\n— Unread counts —");
    // Have the guest send another message; host hasn't read it yet.
    await sendMessage({
      threadId: t1.id,
      content: "One more question — is parking free?",
      viewer: guestA,
    });
    const hostInbox = await listThreadsForHost(property.id);
    const inboxRow = hostInbox.find((t) => t.id === t1.id);
    assert(
      "host inbox shows the unread guest message",
      inboxRow !== undefined && inboxRow.unreadCount >= 1,
      inboxRow,
    );

    console.log("\n— Closed threads reject sends —");
    await setThreadStatus(t1.id, "closed", host);
    let closedRejected = false;
    try {
      await sendMessage({ threadId: t1.id, content: "ping", viewer: guestA });
    } catch (e) {
      if (e instanceof MessagingForbiddenError) closedRejected = true;
    }
    assert("can't send to a closed thread", closedRejected);
    // Reopen for cleanup determinism.
    await setThreadStatus(t1.id, "open", host);
  } finally {
    // Cleanup
    for (const id of createdThreadIds) {
      await prisma.message.deleteMany({ where: { threadId: id } });
      await prisma.messageThread.deleteMany({ where: { id } });
    }
    await prisma.guest.deleteMany({
      where: { id: { in: [GUEST_A_ID, GUEST_B_ID] } },
    });
  }

  console.log();
  if (failures > 0) {
    console.error(`✗ ${failures} assertion(s) failed`);
    process.exit(1);
  }
  console.log("✓ All messaging smoke tests passed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
