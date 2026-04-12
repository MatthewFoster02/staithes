// One-shot script to bootstrap the hosted Supabase + Prisma database.
//
// Loads .env.production (gitignored) and runs, in order:
//   1. prisma migrate deploy   (apply migrations to the hosted DB)
//   2. tsx prisma/seed.ts      (seed property + amenities + site config)
//   3. tsx scripts/setup-storage.ts  (create buckets + upload dev photos)
//
// Run with:  npx tsx scripts/prod-bootstrap.ts
//
// Safe to re-run: every step is idempotent.
//
// IMPORTANT: this is for the *initial* bootstrap of a fresh hosted
// Supabase project. For subsequent schema changes, you'd run a
// targeted `prisma migrate deploy` from CI or via this script again.

import { config as loadEnv } from "dotenv";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const ENV_FILE = ".env.production";

if (!existsSync(ENV_FILE)) {
  console.error(`✗ ${ENV_FILE} not found at the repo root.`);
  process.exit(1);
}

const result = loadEnv({ path: ENV_FILE });
if (result.error) {
  console.error(`✗ Failed to load ${ENV_FILE}:`, result.error);
  process.exit(1);
}

const required = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(
    `✗ ${ENV_FILE} is missing required keys:\n  - ${missing.join("\n  - ")}`,
  );
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL ?? "";
const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
console.log(`▸ Bootstrapping prod against:`);
console.log(`    DB    : ${redactUrl(dbUrl)}`);
console.log(`    Supa  : ${supaUrl}`);
console.log();

if (
  dbUrl.includes("127.0.0.1") ||
  dbUrl.includes("localhost") ||
  supaUrl.includes("127.0.0.1") ||
  supaUrl.includes("localhost")
) {
  console.error(
    "✗ Refusing to run: DATABASE_URL or NEXT_PUBLIC_SUPABASE_URL points at localhost.",
  );
  console.error("  This script is for the *hosted* environment only.");
  process.exit(1);
}

runStep("Apply migrations to hosted DB", "npx", ["prisma", "migrate", "deploy"]);
runStep("Seed property, amenities, site config", "npx", ["tsx", "prisma/seed.ts"]);
runStep("Create storage buckets and upload photos", "npx", ["tsx", "scripts/setup-storage.ts"]);

console.log();
console.log("✓ Prod bootstrap complete.");

function runStep(label: string, command: string, args: string[]): void {
  console.log(`\n— ${label} —`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    console.error(`\n✗ Step failed: ${label}`);
    process.exit(result.status ?? 1);
  }
}

function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = "***";
    return parsed.toString();
  } catch {
    return "<invalid url>";
  }
}
