import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { AdminReviewCard, type AdminReviewItem } from "@/components/admin/admin-review-card";

export const metadata: Metadata = {
  title: "Admin · Reviews",
};

export default async function AdminReviewsPage() {
  const property = await prisma.property.findFirst({ select: { id: true } });
  if (!property) {
    return (
      <article className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-sm text-neutral-600">No property configured.</p>
      </article>
    );
  }

  const reviews = await prisma.review.findMany({
    where: { propertyId: property.id },
    include: {
      guest: { select: { firstName: true, lastName: true, email: true } },
      booking: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const items: AdminReviewItem[] = reviews.map((r) => ({
    id: r.id,
    guestName: `${r.guest.firstName} ${r.guest.lastName}`,
    guestEmail: r.guest.email,
    ratingOverall: Number(r.ratingOverall),
    ratingCleanliness: Number(r.ratingCleanliness),
    ratingAccuracy: Number(r.ratingAccuracy),
    ratingCommunication: Number(r.ratingCommunication),
    ratingLocation: Number(r.ratingLocation),
    ratingValue: Number(r.ratingValue),
    reviewText: r.reviewText,
    hostResponse: r.hostResponse,
    hostRespondedAtISO: r.hostRespondedAt?.toISOString() ?? null,
    isPublished: r.isPublished,
    createdAtISO: r.createdAt.toISOString(),
    bookingHref: `/admin/bookings/${r.booking.id}`,
  }));

  const publishedCount = items.filter((i) => i.isPublished).length;
  const hiddenCount = items.length - publishedCount;
  const avg =
    items.length > 0
      ? items.reduce((sum, i) => sum + i.ratingOverall, 0) / items.length
      : null;

  return (
    <article className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Reviews</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {items.length === 0
            ? "No reviews yet — they'll appear here once your first guests have stayed."
            : `${items.length} total · ${publishedCount} published · ${hiddenCount} hidden${avg !== null ? ` · ${avg.toFixed(1)} / 5 average` : ""}`}
        </p>
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
          No reviews to moderate.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((review) => (
            <AdminReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}
    </article>
  );
}
