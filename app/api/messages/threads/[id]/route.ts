import { NextResponse } from "next/server";
import { z } from "zod";
import {
  readThread,
  sendMessage,
  setThreadStatus,
  MessagingForbiddenError,
  MessagingNotFoundError,
} from "@/lib/messaging/threads";
import { resolveViewer } from "@/lib/messaging/auth";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function mapError(err: unknown): NextResponse | null {
  if (err instanceof MessagingForbiddenError) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  if (err instanceof MessagingNotFoundError) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
  return null;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await resolveViewer();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  try {
    const detail = await readThread(id, auth.viewer);
    return NextResponse.json(detail);
  } catch (err) {
    const mapped = mapError(err);
    if (mapped) return mapped;
    throw err;
  }
}

const SendBodySchema = z.object({
  content: z.string().min(1).max(4000),
});

export async function POST(request: Request, context: RouteContext) {
  const auth = await resolveViewer();
  if (!auth.ok) return auth.response;

  const json = await request.json().catch(() => null);
  const parsed = SendBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  try {
    const message = await sendMessage({
      threadId: id,
      content: parsed.data.content,
      viewer: auth.viewer,
    });
    return NextResponse.json({ messageId: message.id });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped) return mapped;
    throw err;
  }
}

const PatchBodySchema = z.object({
  status: z.enum(["open", "closed", "archived"]),
});

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await resolveViewer();
  if (!auth.ok) return auth.response;

  const json = await request.json().catch(() => null);
  const parsed = PatchBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  try {
    await setThreadStatus(id, parsed.data.status, auth.viewer);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped) return mapped;
    throw err;
  }
}
