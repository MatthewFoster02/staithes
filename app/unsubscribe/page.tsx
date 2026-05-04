import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ t?: string }>;
}

// One-click unsubscribe — no auth. The token is per-guest and
// random; possessing it is sufficient proof that the link came from
// an email we sent. Idempotent: visiting the URL after already
// unsubscribing still says "you're unsubscribed".
//
// We deliberately do NOT clear the token after unsubscribing — the
// guest can re-subscribe via a future booking and we'd reuse the
// same token rather than handing them a fresh one.
export default async function UnsubscribePage({ searchParams }: PageProps) {
  const { t } = await searchParams;

  if (!t) {
    return (
      <Frame title="Invalid unsubscribe link">
        <p>This unsubscribe link is missing its token. If you got here from
        an email, try clicking the link again.</p>
      </Frame>
    );
  }

  const guest = await prisma.guest.findUnique({
    where: { unsubscribeToken: t },
    select: { id: true, email: true, marketingOptIn: true },
  });

  if (!guest) {
    return (
      <Frame title="Link not recognised">
        <p>We couldn&rsquo;t find an account for this unsubscribe link. You
        may have already unsubscribed, or the link may have been changed.</p>
      </Frame>
    );
  }

  if (guest.marketingOptIn) {
    await prisma.guest.update({
      where: { id: guest.id },
      data: { marketingOptIn: false },
    });
  }

  return (
    <Frame title="You're unsubscribed">
      <p>
        We won&rsquo;t send any more marketing emails to{" "}
        <strong>{guest.email}</strong>. Booking confirmations and
        transactional emails will still come through as usual.
      </p>
      <p className="mt-4">
        Changed your mind?{" "}
        <Link href="/" className="font-medium text-neutral-900 underline">
          Visit the site
        </Link>{" "}
        — you can opt back in next time you book.
      </p>
    </Frame>
  );
}

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-6 py-12">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="space-y-2 text-sm text-neutral-700">{children}</div>
    </section>
  );
}
