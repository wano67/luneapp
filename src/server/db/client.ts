// src/server/db/client.ts
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import type { PoolConfig } from 'pg';

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

  const poolConfig: PoolConfig = { connectionString };

  try {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get('sslmode');
    const sslAccept = url.searchParams.get('sslaccept');
    const enableSsl = sslMode && sslMode !== 'disable';
    const allowInvalidCerts = sslAccept === 'accept_invalid_certs';

    if (enableSsl) {
      // Allow explicitly opting into skipping CA validation for self-signed certs in dev.
      poolConfig.ssl = { rejectUnauthorized: !allowInvalidCerts };
    }
  } catch (error) {
    console.warn('Failed to parse DATABASE_URL for SSL options', error);
  }

  const pool = new pg.Pool(poolConfig);
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
