// Returns the given path only if it's a safe relative URL within
// our own app — guards against open-redirect attacks via the `next`
// query param. Anything that's not a same-origin relative path
// (starts with `/` and not `//`) falls back to the default.
export function safeNext(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  return value;
}
