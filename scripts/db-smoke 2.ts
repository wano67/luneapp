import 'dotenv/config';
import type pg from 'pg';
import { createDbClient, mustGetEnv } from './db-client.js';

let prisma: import('../src/generated/prisma/client').PrismaClient | null = null;
let pool: pg.Pool | null = null;

async function main() {
  mustGetEnv('DATABASE_URL');
  const created = createDbClient();
  prisma = created.prisma;
  pool = created.pool;

  const columns = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema='public'
       AND table_name='Business'
       AND column_name='legalName'`
  );
  console.log('Business.legalName present:', columns.length > 0);

  const business = await prisma.business.findFirst().catch((err: unknown) => {
    console.error('findFirst error', err);
    return null;
  });

  console.log('Sample business:', business ? String(business.id) : 'none');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
    if (pool) {
      await pool.end();
    }
  });
