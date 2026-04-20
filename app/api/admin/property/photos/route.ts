import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/db/prisma";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { isHostEmail } from "@/lib/auth/host";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

async function requireHost() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Not signed in" };
  if (!isHostEmail(user.email)) return { ok: false as const, status: 403, error: "Forbidden" };
  return { ok: true as const };
}

// Upload one or more photos. Accepts multipart form data with one
// or more `file` entries. Each file is uploaded to the property-photos
// bucket under a UUID filename (keeps guest-supplied names out of the
// public URL) and a matching PropertyPhoto row is created.
export async function POST(request: Request) {
  const auth = await requireHost();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const formData = await request.formData();
  const files = formData.getAll("file").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const property = await prisma.property.findFirst({ select: { id: true } });
  if (!property) {
    return NextResponse.json({ error: "No property configured" }, { status: 404 });
  }

  const maxSort = await prisma.propertyPhoto.aggregate({
    where: { propertyId: property.id },
    _max: { sortOrder: true },
  });
  let nextSort = (maxSort._max.sortOrder ?? 0) + 10;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const createdIds: string[] = [];
  for (const file of files) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const contentType = CONTENT_TYPE_BY_EXT[ext] ?? file.type ?? "application/octet-stream";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json(
        { error: `"${file.name}" is not an image` },
        { status: 400 },
      );
    }

    // Random UUID-ish filename. Crypto.randomUUID is in the Web
    // standard but TS wants us to use it via globalThis.
    const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    const storagePath = `${suffix}.${ext || "jpg"}`;
    const buffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("property-photos")
      .upload(storagePath, buffer, { contentType });
    if (uploadError) {
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 },
      );
    }

    const photo = await prisma.propertyPhoto.create({
      data: {
        propertyId: property.id,
        url: storagePath,
        altText: file.name.replace(/\.[^.]+$/, "") || "Property photo",
        category: "other",
        sortOrder: nextSort,
      },
    });
    createdIds.push(photo.id);
    nextSort += 10;
  }

  return NextResponse.json({ ok: true, createdIds });
}
