import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getEnv } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const env = getEnv();
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL, max: env.isProduction ? 10 : 5 });
  return new PrismaClient({
    adapter,
    log: env.isDevelopment ? ["warn", "error"] : ["error"],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (!getEnv().isProduction) {
  globalForPrisma.prisma = prisma;
}

export type { PrismaClient };
export { Prisma } from "@/generated/prisma/client";

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
