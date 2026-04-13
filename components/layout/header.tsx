import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { signOutAction } from "@/lib/auth/actions";

export async function Header() {
  const user = await getCurrentUser();

  // Run the signed-in lookups in parallel: profile + unread message
  // count. The unread count is the number of guest-side messages from
  // the OTHER side that haven't been read yet, in any of this guest's
  // threads.
  const [guest, unreadMessages] = user
    ? await Promise.all([
        prisma.guest.findUnique({
          where: { id: user.id },
          select: { firstName: true },
        }),
        prisma.message.count({
          where: {
            isRead: false,
            senderType: { in: ["host", "system"] },
            thread: { guestId: user.id },
          },
        }),
      ])
    : [null, 0];

  return (
    <header className="border-b border-neutral-200">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Staithes
        </Link>
        <nav className="flex items-center gap-6 text-sm text-neutral-600">
          <Link href="/" className="hover:text-neutral-900">
            Home
          </Link>
          {user ? (
            <>
              <Link
                href="/dashboard/messages"
                className="relative hover:text-neutral-900"
              >
                Messages
                {unreadMessages > 0 && (
                  <span className="absolute -top-2 -right-3 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-semibold text-white">
                    {unreadMessages}
                  </span>
                )}
              </Link>
              <Link href="/dashboard" className="hover:text-neutral-900">
                Hi, {guest?.firstName ?? "guest"}
              </Link>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="cursor-pointer text-neutral-600 hover:text-neutral-900"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-neutral-900">
                Sign in
              </Link>
              <Link href="/signup" className="hover:text-neutral-900">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
