import { Pool } from 'pg';
import type { PoolConfig } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/index.js';

export function mustGetEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env ${key}`);
  }
  return value;
}

export function createDbClient() {
  const connectionString = mustGetEnv('DATABASE_URL');
  const shouldRelaxTls = process.env.DB_INSPECT_INSECURE_TLS === '1';

  const poolConfig: PoolConfig = {
    connectionString,
  };

  if (shouldRelaxTls) {
    poolConfig.ssl = { rejectUnauthorized: false };
  } else {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get('sslmode');
    if (sslMode && sslMode !== 'disable') {
      poolConfig.ssl = { rejectUnauthorized: true };
    }
  }

  const pool = new Pool(poolConfig);
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  return { prisma, pool };
}
