// Helpers for resolving Supabase Storage paths to public URLs, with
// optional on-the-fly image transformation via the render API.
//
// PropertyPhoto.url stores a path-only value (relative to the bucket),
// e.g. "drone_shot.jpeg". These helpers turn that into a full URL,
// which keeps the DB portable across local/staging/prod environments.

const PROPERTY_PHOTOS_BUCKET = "property-photos";

function requireSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  return url.replace(/\/$/, "");
}

export function propertyPhotoUrl(path: string): string {
  return `${requireSupabaseUrl()}/storage/v1/object/public/${PROPERTY_PHOTOS_BUCKET}/${path}`;
}

export interface TransformOptions {
  width?: number;
  height?: number;
  resize?: "cover" | "contain" | "fill";
  quality?: number;
}

// Returns a Supabase Storage transform URL. Requires the Supabase
// `image_transformation` service to be enabled (Pro plan in hosted
// Supabase, enabled locally via supabase/config.toml). On free tier,
// prefer next/image for optimisation instead.
export function propertyPhotoTransformUrl(
  path: string,
  options: TransformOptions = {},
): string {
  const params = new URLSearchParams();
  if (options.width) params.set("width", String(options.width));
  if (options.height) params.set("height", String(options.height));
  if (options.resize) params.set("resize", options.resize);
  if (options.quality) params.set("quality", String(options.quality));
  const query = params.toString();
  const base = `${requireSupabaseUrl()}/storage/v1/render/image/public/${PROPERTY_PHOTOS_BUCKET}/${path}`;
  return query ? `${base}?${query}` : base;
}

export function propertyThumbnailUrl(path: string, width = 480): string {
  return propertyPhotoTransformUrl(path, { width, resize: "cover", quality: 80 });
}
