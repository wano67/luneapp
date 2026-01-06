#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require('node:child_process');

const url = process.env.DATABASE_URL;
const skip = process.env.SKIP_PRISMA_GENERATE === '1';

if (skip) {
  console.log('[postinstall] SKIP_PRISMA_GENERATE=1 → prisma generate skipped.');
  process.exit(0);
}

if (!url) {
  console.log('[postinstall] DATABASE_URL is not set. Skipping prisma generate (set SKIP_PRISMA_GENERATE=1 to silence this message).');
  process.exit(0);
}

try {
  execSync('pnpm db:generate', { stdio: 'inherit' });
} catch (err) {
  console.error('[postinstall] prisma generate failed:', err?.message || err);
  process.exit(1);
}
