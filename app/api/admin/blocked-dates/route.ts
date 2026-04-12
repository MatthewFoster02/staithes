import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { isHostEmail } from "@/lib/auth/host";
import { parseISODate } from "@/lib/availability/dates";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  dateStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(200).optional(),
});

// Belt-and-braces auth: the proxy already gates /api/admin/* against
// non-hosts, but the route re-checks server-side so a missing prefix
// in the proxy can't expose mutations.
async function requireHost() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Not signed in" };
  if (!isHostEmail(user.email)) return { ok: false as const, status: 403, error: "Forbidden" };
  return { ok: true as const, user };
}

export async function POST(request: Request) {
  const auth = await requireHost();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const dateStart = parseISODate(parsed.data.dateStart);
  const dateEnd = parseISODate(parsed.data.dateEnd);
  if (dateEnd < dateStart) {
    return NextResponse.json(
      { error: "End date must be on or after start date" },
      { status: 400 },
    );
  }

  const property = await prisma.property.findFirst({ select: { id: true } });
  if (!property) {
    return NextResponse.json({ error: "No property configured" }, { status: 404 });
  }

  const created = await prisma.blockedDate.create({
    data: {
      propertyId: property.id,
      dateStart,
      dateEnd,
      reason: parsed.data.reason,
    },
  });

  return NextResponse.json({ id: created.id });
}
