import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { isHostEmail } from "@/lib/auth/host";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  filter: z.enum(["all", "opted-in", "opted-out"]).default("opted-in"),
});

// CSV escape: wrap in quotes and double any internal quotes if the
// value contains a comma, quote, or newline.
function csvCell(value: string | null | undefined): string {
  const v = value ?? "";
  if (/[",\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isHostEmail(user.email)) {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({ filter: url.searchParams.get("filter") ?? undefined });
  const filter = parsed.success ? parsed.data.filter : "opted-in";

  const guests = await prisma.guest.findMany({
    where: {
      ...(filter === "opted-in" ? { marketingOptIn: true } : {}),
      ...(filter === "opted-out" ? { marketingOptIn: false } : {}),
    },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      country: true,
      marketingOptIn: true,
      marketingOptInAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const header = [
    "email",
    "first_name",
    "last_name",
    "country",
    "marketing_opt_in",
    "opted_in_at",
    "joined_at",
  ];
  const rows = guests.map((g) =>
    [
      csvCell(g.email),
      csvCell(g.firstName),
      csvCell(g.lastName),
      csvCell(g.country),
      g.marketingOptIn ? "true" : "false",
      g.marketingOptInAt?.toISOString() ?? "",
      g.createdAt.toISOString(),
    ].join(","),
  );
  const body = [header.join(","), ...rows].join("\r\n") + "\r\n";

  const filename = `guests-${filter}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
