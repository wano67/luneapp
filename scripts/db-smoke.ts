import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

function mustGetEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is not set (check env)`);
  }
  return value;
}

const DATABASE_URL = mustGetEnv('DATABASE_URL');
const allowInsecureTls = process.env.DB_INSPECT_INSECURE_TLS === '1';
let prisma: import('../src/generated/prisma/client').PrismaClient | null = null;
let pool: pg.Pool | null = null;

async function main() {
  if (allowInsecureTls) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }
  const poolConfig: pg.PoolConfig = { connectionString: DATABASE_URL };
  try {
    const url = new URL(DATABASE_URL);
    const sslMode = url.searchParams.get('sslmode');
    const sslAccept = url.searchParams.get('sslaccept');
    const enableSsl = sslMode && sslMode !== 'disable';
    const allowInvalidCerts = sslAccept === 'accept_invalid_certs' || allowInsecureTls;
    if (enableSsl) {
      poolConfig.ssl = { rejectUnauthorized: !allowInvalidCerts };
    }
  } catch (err) {
    console.warn('Failed to parse DATABASE_URL, continuing without SSL tweaks', err);
  }
  if (allowInsecureTls) {
    poolConfig.ssl = { rejectUnauthorized: false };
  } else if (!poolConfig.ssl) {
    poolConfig.ssl = { rejectUnauthorized: true };
  }

  const { PrismaClient } = await import('../src/generated/prisma/index.js');
  pool = new pg.Pool(poolConfig);
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });

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
