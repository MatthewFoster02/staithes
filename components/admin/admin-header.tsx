import Link from "next/link";
import { signOutAction } from "@/lib/auth/actions";
import { LiveUnreadBadge } from "@/components/messaging/live-unread-badge";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/calendar", label: "Calendar" },
];

interface AdminHeaderProps {
  firstName: string | null;
  unreadMessages: number;
}

export function AdminHeader({ firstName, unreadMessages }: AdminHeaderProps) {
  return (
    <header className="border-b border-neutral-200 bg-neutral-900 text-neutral-100">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/admin/dashboard" className="text-lg font-semibold tracking-tight">
          Staithes <span className="text-neutral-400">Admin</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm text-neutral-300">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-white">
              {item.label}
            </Link>
          ))}
          <Link href="/admin/messages" className="relative hover:text-white">
            Messages
            <LiveUnreadBadge initialCount={unreadMessages} colorClass="bg-emerald-500" />
          </Link>
          <Link href="/" className="hover:text-white">
            View site
          </Link>
          <span className="hidden text-neutral-500 sm:inline">|</span>
          {firstName && <span className="hidden sm:inline">{firstName}</span>}
          <form action={signOutAction}>
            <button
              type="submit"
              className="cursor-pointer text-neutral-300 hover:text-white"
            >
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
