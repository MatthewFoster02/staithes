import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Booking confirmed",
};

// The booking is moved to `confirmed` status by the Stripe webhook
// (Task 2.7), not by this page. The page exists purely to thank the
// guest and tell them what happens next. We deliberately do NOT mark
// the booking confirmed here — relying on the redirect would let a
// malicious user fake a confirmation by hand-crafting the URL.
export default function BookingSuccessPage() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 py-12 text-center">
      <CheckCircle2 className="size-12 text-emerald-600" aria-hidden />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Thanks for your booking</h1>
      <p className="mt-3 text-sm text-neutral-600">
        Your payment has been received. We&rsquo;ll send you a confirmation email
        with all the details shortly.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 text-sm font-medium text-neutral-900 underline-offset-4 hover:underline"
      >
        Go to your dashboard
      </Link>
    </section>
  );
}
