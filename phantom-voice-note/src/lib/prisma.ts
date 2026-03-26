import { PrismaClient } from "@/generated/prisma/client";

// Prevent exhausting database connections in dev (Next.js hot reload).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Keep connection pooling on Vercel-friendly runtimes.
    // (Prisma reads DATABASE_URL from environment at runtime.)
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

