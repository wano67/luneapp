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
    const tables = await prisma.$queryRawUnsafe<Array<{ table_schema: string; table_name: string }>>(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE'
      ORDER BY table_name;
    `);
    console.log('--- all tables ---');
    console.table(tables);
  } catch (err) {
    console.error('Failed to list all tables', err);
  }

  try {
    const keyTables = await prisma.$queryRawUnsafe<
      Array<{
        BusinessDocument: string | null;
        ProductImage: string | null;
        ServiceTemplateTask: string | null;
        ServiceTaskTemplate: string | null;
        Service: string | null;
        Product: string | null;
      }>
    >(`
      SELECT
        to_regclass('public."BusinessDocument"')::text AS "BusinessDocument",
        to_regclass('public."ProductImage"')::text AS "ProductImage",
        to_regclass('public."ServiceTemplateTask"')::text AS "ServiceTemplateTask",
        to_regclass('public."ServiceTaskTemplate"')::text AS "ServiceTaskTemplate",
        to_regclass('public."Service"')::text AS "Service",
        to_regclass('public."Product"')::text AS "Product";
    `);
    console.log('--- key tables existence ---');
    console.table(keyTables);
  } catch (err) {
    console.error('Failed to check key tables', err);
  }

  try {
    const serviceTaskTemplateColumns = await prisma.$queryRawUnsafe<
      Array<{
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
      }>
    >(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema='public'
        AND table_name='ServiceTaskTemplate'
        AND column_name IN ('estimatedMinutes', 'position')
      ORDER BY column_name;
    `);
    console.log('--- columns check: ServiceTaskTemplate ---');
    console.table(serviceTaskTemplateColumns);
  } catch (err) {
    console.error('Failed to check ServiceTaskTemplate columns', err);
  }

  try {
    const businessDocumentColumns = await prisma.$queryRawUnsafe<
      Array<{
        column_name: string;
        data_type: string;
        datetime_precision: number | null;
        is_nullable: string;
        column_default: string | null;
      }>
    >(`
      SELECT column_name, data_type, datetime_precision, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema='public'
        AND table_name='BusinessDocument'
        AND column_name IN ('createdAt', 'storageKey')
      ORDER BY column_name;
    `);
    console.log('--- columns check: BusinessDocument (createdAt, storageKey) ---');
    console.table(businessDocumentColumns);
  } catch (err) {
    console.error('Failed to check BusinessDocument columns', err);
  }

  try {
    const businessDocumentUniques = await prisma.$queryRawUnsafe<
      Array<{ conname: string; contype: string; definition: string }>
    >(`
      SELECT conname::text AS conname, contype::text AS contype, pg_get_constraintdef(c.oid)::text AS definition
      FROM pg_constraint c
      WHERE c.conrelid = 'public."BusinessDocument"'::regclass
        AND c.contype IN ('u', 'f');
    `);
    console.log('--- constraints: BusinessDocument (unique + FK) ---');
    console.table(businessDocumentUniques);
  } catch (err) {
    console.error('Failed to list BusinessDocument constraints', err);
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
