import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { signOutAction } from "@/lib/auth/actions";

export async function Header() {
  const user = await getCurrentUser();
  const guest = user
    ? await prisma.guest.findUnique({
        where: { id: user.id },
        select: { firstName: true },
      })
    : null;

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
