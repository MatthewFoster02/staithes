import { NextResponse } from "next/server";
import { expireStalePendingBookings } from "@/lib/booking/expire";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Vercel Cron pings this on a schedule (see vercel.json). The endpoint
// is also reachable from outside Vercel — anyone hitting the URL would
// trigger a sweep — so it's bearer-token protected by CRON_SECRET.
//
// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically
// when the env var is set; for local testing run:
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//        http://localhost:3000/api/cron/expire-bookings
export async function GET(request: Request) {
  return handle(request);
}

// Allow POST too — some cron providers (and the Vercel CLI's `vercel
// cron` command) use POST. Same auth, same handler.
export async function POST(request: Request) {
  return handle(request);
}

async function handle(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not set");
    return NextResponse.json({ error: "cron misconfigured" }, { status: 500 });
  }

  const auth = request.headers.get("authorization");
  const expected = `Bearer ${secret}`;
  if (auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await expireStalePendingBookings();
  console.log(`[cron] expire-bookings swept ${result.cancelled} pending booking(s)`);
  return NextResponse.json({ ok: true, cancelled: result.cancelled });
}
