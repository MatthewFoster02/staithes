import { NextResponse } from "next/server";
import { processBookingEmails } from "@/lib/email/scheduler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Email rendering + sending can take a few seconds per booking; bump
// the function timeout above the default 10s. Vercel hobby caps this
// to 60s; Pro allows higher.
export const maxDuration = 60;

export async function GET(request: Request) {
  return handle(request);
}
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
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await processBookingEmails();
  console.log(`[cron] process-emails result:`, result);
  return NextResponse.json({ ok: true, ...result });
}
