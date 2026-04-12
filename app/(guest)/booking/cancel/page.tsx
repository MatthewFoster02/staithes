import type { Metadata } from "next";
import Link from "next/link";
import { XCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Booking cancelled",
};

export default function BookingCancelPage() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 py-12 text-center">
      <XCircle className="size-12 text-neutral-400" aria-hidden />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Booking not completed</h1>
      <p className="mt-3 text-sm text-neutral-600">
        You closed the payment page before finishing. No payment was taken and
        your booking has not been confirmed. The dates are still held briefly
        if you&rsquo;d like to try again.
      </p>
      <Link
        href="/"
        className="mt-8 text-sm font-medium text-neutral-900 underline-offset-4 hover:underline"
      >
        Back to the property
      </Link>
    </section>
  );
}
