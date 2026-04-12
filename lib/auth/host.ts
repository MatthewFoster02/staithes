// Host role check via env var. Option (a) from the build plan: a
// comma-separated list of email addresses that get admin access.
// Cheap, no migration, easy to change. If the host count ever grows
// beyond a couple of people, swap to a Role enum on Guest.

export function getHostEmails(): string[] {
  const raw = process.env.HOST_EMAILS ?? "";
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isHostEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getHostEmails().includes(email.toLowerCase());
}
