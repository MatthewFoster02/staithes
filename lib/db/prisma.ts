import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

// Lazy singleton: the underlying PrismaClient is constructed on the
// first property access, not at module load. This matters for CLI
// scripts whose `import` statements are hoisted above any `dotenv`
// calls — eager construction would read `process.env.DATABASE_URL`
// before the env file is loaded and crash. In Next.js route handlers
// and server components the env is already populated, so the lazy
// path collapses to a no-op on first access.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getPrisma(), prop, receiver);
  },
}) as PrismaClient;
