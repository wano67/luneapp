import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

function mustGetEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is not set (check .env/.env.local or CI secrets)`);
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

  try {
    const migrations = await prisma.$queryRawUnsafe<
      Array<{
        migration_name: string;
        started_at: Date | null;
        finished_at: Date | null;
        rolled_back_at: Date | null;
        applied_steps_count: number | null;
        logs: string | null;
      }>
    >(`
      SELECT migration_name, started_at, finished_at, rolled_back_at, applied_steps_count, logs
      FROM "_prisma_migrations"
      ORDER BY started_at DESC
      LIMIT 50
    `);

    console.log('--- _prisma_migrations (top 50) ---');
    console.table(migrations);
  } catch (err) {
    console.error('Failed to read _prisma_migrations', err);
  }

  try {
    const tables = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
      SELECT
        current_database() AS db,
        current_schema() AS schema,
        to_regclass('public."User"')::text AS user_table,
        to_regclass('public."Business"')::text AS business_table,
        to_regclass('public."_prisma_migrations"')::text AS migrations_table
    `);
    console.log('--- tables ---');
    console.table(tables);
  } catch (err) {
    console.error('Failed to read tables', err);
  }
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
