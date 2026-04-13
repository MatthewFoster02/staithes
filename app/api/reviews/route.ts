import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { submitReview } from "@/lib/reviews/service";

export const dynamic = "force-dynamic";

const RatingSchema = z.number().min(1).max(5);

const BodySchema = z.object({
  bookingId: z.string().uuid(),
  ratingOverall: RatingSchema,
  ratingCleanliness: RatingSchema,
  ratingAccuracy: RatingSchema,
  ratingCommunication: RatingSchema,
  ratingLocation: RatingSchema,
  ratingValue: RatingSchema,
  reviewText: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await submitReview({
    guestId: user.id,
    ...parsed.data,
  });

  if (!result.ok) {
    const status =
      result.error === "not_found" || result.error === "not_yours"
        ? 404
        : result.error === "already_reviewed"
          ? 409
          : 400;
    return NextResponse.json({ error: result.message }, { status });
  }

  return NextResponse.json({ reviewId: result.reviewId });
}
