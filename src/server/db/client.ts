// src/server/db/client.ts
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

let prismaInstance: PrismaClient | undefined;
let warned = false;

function createDisabledPrisma(message: string) {
  if (!warned) {
    console.warn(message);
    warned = true;
  }

  return new Proxy({} as PrismaClient, {
    get(_target, prop) {
      throw new Error(`${message} (accessed prisma.${String(prop)})`);
    },
  });
}

function initPrisma() {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  if (prismaInstance) return prismaInstance;

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    prismaInstance = createDisabledPrisma('DATABASE_URL is not set; Prisma client is disabled');
    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = prismaInstance;
    }
    return prismaInstance;
  }

  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  prismaInstance = new PrismaClient({
    adapter,
    log: ['error', 'warn'],
  });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prismaInstance;
  }

  return prismaInstance;
}

export const prisma = initPrisma();
