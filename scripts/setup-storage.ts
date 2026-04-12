// One-shot script to create Supabase Storage buckets, upload the
// development photos in dev_photos/, and create PropertyPhoto rows
// pointing to them.
//
// Idempotent: safe to run multiple times. Skips files that are already
// uploaded and PropertyPhoto rows that already exist for the same path.
//
// Run with: npx tsx scripts/setup-storage.ts

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const PROPERTY_PHOTOS_BUCKET = "property-photos";
const SITE_ASSETS_BUCKET = "site-assets";
const DEV_PHOTOS_DIR = "dev_photos";

interface PhotoMeta {
  filename: string;
  category: "exterior" | "living" | "bedroom" | "kitchen" | "bathroom" | "garden" | "other";
  altText: string;
  sortOrder: number;
}

// Sort order = display order on the property page. First 5 are the
// "featured" set shown above the fold per the Build Plan.
const PHOTO_METADATA: PhotoMeta[] = [
  { filename: "drone_shot.jpeg", category: "exterior", altText: "Aerial view of the property and surrounding area", sortOrder: 10 },
  { filename: "outside_front.jpeg", category: "exterior", altText: "Front of the property from the road", sortOrder: 20 },
  { filename: "Downstairs_living_room.jpeg", category: "living", altText: "Downstairs living room with comfortable seating", sortOrder: 30 },
  { filename: "kitchen.jpeg", category: "kitchen", altText: "Fully equipped kitchen", sortOrder: 40 },
  { filename: "bedroom_1.jpeg", category: "bedroom", altText: "Master bedroom", sortOrder: 50 },
  { filename: "downstairs_living_room_other_shot.jpeg", category: "living", altText: "Alternative view of the downstairs living room", sortOrder: 60 },
  { filename: "conservatory.jpeg", category: "living", altText: "Conservatory with garden views", sortOrder: 70 },
  { filename: "downstairs_other_room.jpeg", category: "living", altText: "Additional downstairs reception room", sortOrder: 80 },
  { filename: "bedroom_2.jpeg", category: "bedroom", altText: "Second bedroom", sortOrder: 90 },
  { filename: "bedroom_3.jpeg", category: "bedroom", altText: "Third bedroom", sortOrder: 100 },
  { filename: "bathroom.jpeg", category: "bathroom", altText: "Bathroom with shower and bath", sortOrder: 110 },
  { filename: "upstairs_landing.jpeg", category: "other", altText: "Upstairs landing", sortOrder: 120 },
  { filename: "back_garden.jpeg", category: "garden", altText: "Back garden with lawn and seating", sortOrder: 130 },
];

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set",
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    // 1. Ensure buckets exist
    for (const bucketId of [PROPERTY_PHOTOS_BUCKET, SITE_ASSETS_BUCKET]) {
      const { data: existing } = await supabase.storage.getBucket(bucketId);
      if (existing) {
        console.log(`• Bucket "${bucketId}" already exists`);
        continue;
      }
      const { error } = await supabase.storage.createBucket(bucketId, {
        public: true,
      });
      if (error) throw error;
      console.log(`✓ Created bucket "${bucketId}" (public)`);
    }

    // 2. Find target property
    const property = await prisma.property.findUnique({
      where: { slug: "staithes" },
    });
    if (!property) {
      throw new Error(
        "No property found with slug 'staithes'. Run `npx prisma db seed` first.",
      );
    }

    // 3. Upload files from dev_photos/
    const filesOnDisk = await readdir(DEV_PHOTOS_DIR);
    const expected = new Set(PHOTO_METADATA.map((m) => m.filename));
    const missing = PHOTO_METADATA
      .filter((m) => !filesOnDisk.includes(m.filename))
      .map((m) => m.filename);
    if (missing.length > 0) {
      console.warn(
        `⚠ The following expected photos are missing from ${DEV_PHOTOS_DIR}/:\n  - ${missing.join("\n  - ")}`,
      );
    }
    const unmapped = filesOnDisk
      .filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f))
      .filter((f) => !expected.has(f));
    if (unmapped.length > 0) {
      console.warn(
        `⚠ Files in ${DEV_PHOTOS_DIR}/ with no metadata mapping (skipped):\n  - ${unmapped.join("\n  - ")}`,
      );
    }

    for (const meta of PHOTO_METADATA) {
      if (!filesOnDisk.includes(meta.filename)) continue;

      const buffer = await readFile(join(DEV_PHOTOS_DIR, meta.filename));
      const contentType = CONTENT_TYPE_BY_EXT[extname(meta.filename).toLowerCase()] ?? "application/octet-stream";

      const { error: uploadError } = await supabase.storage
        .from(PROPERTY_PHOTOS_BUCKET)
        .upload(meta.filename, buffer, { contentType, upsert: true });
      if (uploadError) throw uploadError;
      console.log(`✓ Uploaded ${meta.filename}`);

      // Upsert PropertyPhoto row keyed on (propertyId, url path)
      const existingPhoto = await prisma.propertyPhoto.findFirst({
        where: { propertyId: property.id, url: meta.filename },
      });
      if (existingPhoto) {
        await prisma.propertyPhoto.update({
          where: { id: existingPhoto.id },
          data: {
            category: meta.category,
            altText: meta.altText,
            sortOrder: meta.sortOrder,
          },
        });
      } else {
        await prisma.propertyPhoto.create({
          data: {
            propertyId: property.id,
            url: meta.filename,
            category: meta.category,
            altText: meta.altText,
            sortOrder: meta.sortOrder,
          },
        });
      }
    }

    const total = await prisma.propertyPhoto.count({
      where: { propertyId: property.id },
    });
    console.log(`\n✓ Property "${property.name}" now has ${total} photo records`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
