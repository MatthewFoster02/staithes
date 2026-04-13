import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { todayUTC } from "@/lib/availability/dates";

const { Decimal } = Prisma;

// Reviews are allowed once a stay is over and the booking is in a
// "good" state (confirmed or completed). The booking lifecycle never
// auto-transitions to `completed` yet — that's a Phase 8 cron task —
// so we treat any confirmed booking whose checkOut date is in the
// past as effectively reviewable.
export type SubmitReviewError =
  | "not_found"
  | "not_yours"
  | "not_eligible"
  | "already_reviewed"
  | "invalid_rating";

export interface SubmitReviewArgs {
  bookingId: string;
  guestId: string;
  ratingOverall: number;
  ratingCleanliness: number;
  ratingAccuracy: number;
  ratingCommunication: number;
  ratingLocation: number;
  ratingValue: number;
  reviewText?: string;
}

export type SubmitReviewResult =
  | { ok: true; reviewId: string }
  | { ok: false; error: SubmitReviewError; message: string };

function isValidRating(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  if (value < 1 || value > 5) return false;
  // 0.5 step.
  return Math.round(value * 2) === value * 2;
}

export async function submitReview(args: SubmitReviewArgs): Promise<SubmitReviewResult> {
  const ratings = [
    args.ratingOverall,
    args.ratingCleanliness,
    args.ratingAccuracy,
    args.ratingCommunication,
    args.ratingLocation,
    args.ratingValue,
  ];
  if (ratings.some((r) => !isValidRating(r))) {
    return { ok: false, error: "invalid_rating", message: "All ratings must be between 1 and 5." };
  }

  const booking = await prisma.booking.findUnique({
    where: { id: args.bookingId },
    select: {
      id: true,
      guestId: true,
      propertyId: true,
      status: true,
      checkOut: true,
      review: { select: { id: true } },
    },
  });
  if (!booking) {
    return { ok: false, error: "not_found", message: "Booking not found." };
  }
  if (booking.guestId !== args.guestId) {
    return { ok: false, error: "not_yours", message: "Booking not found." };
  }
  if (booking.review) {
    return { ok: false, error: "already_reviewed", message: "You've already reviewed this stay." };
  }
  if (booking.status !== "confirmed" && booking.status !== "completed") {
    return { ok: false, error: "not_eligible", message: "This booking can't be reviewed." };
  }
  if (booking.checkOut > todayUTC()) {
    return {
      ok: false,
      error: "not_eligible",
      message: "You can leave a review after your stay ends.",
    };
  }

  const created = await prisma.review.create({
    data: {
      bookingId: booking.id,
      guestId: args.guestId,
      propertyId: booking.propertyId,
      ratingOverall: new Decimal(args.ratingOverall),
      ratingCleanliness: new Decimal(args.ratingCleanliness),
      ratingAccuracy: new Decimal(args.ratingAccuracy),
      ratingCommunication: new Decimal(args.ratingCommunication),
      ratingLocation: new Decimal(args.ratingLocation),
      ratingValue: new Decimal(args.ratingValue),
      reviewText: args.reviewText?.trim() || null,
      isPublished: true,
    },
  });

  return { ok: true, reviewId: created.id };
}
