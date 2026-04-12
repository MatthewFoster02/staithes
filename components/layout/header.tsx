import Link from "next/link";

export function Header() {
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
          <Link href="/login" className="hover:text-neutral-900">
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
