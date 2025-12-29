import 'dotenv/config';
import type pg from 'pg';
import { createDbClient, mustGetEnv } from './db-client.js';

let prisma: import('../src/generated/prisma/client').PrismaClient | null = null;
let pool: pg.Pool | null = null;

async function main() {
  mustGetEnv('DATABASE_URL'); // early and explicit
  const created = createDbClient();
  prisma = created.prisma;
  pool = created.pool;

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
