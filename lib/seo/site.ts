// Resolves the canonical site URL. Falls back to localhost in dev so
// the metadataBase is always a valid URL.
export function siteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "http://localhost:3000";
}
