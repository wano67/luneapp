import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { getRequestId, withRequestId } from '@/server/http/apiUtils';
import { withNoStore } from '@/server/security/csrf';
import { isTransientDbError } from '@/server/db/prisma-errors';
import { isDbCircuitOpen, markDbDown } from '@/server/db/db-circuit';

const HEALTHCHECK_TIMEOUT_MS = 2_000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error('DB healthcheck timeout')), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const dbUrl = process.env.DATABASE_URL?.trim();

  if (!dbUrl) {
    return withNoStore(
      withRequestId(NextResponse.json({ ok: true, db: 'disabled' }), requestId)
    );
  }

  if (isDbCircuitOpen()) {
    return withNoStore(
      withRequestId(
        NextResponse.json({ ok: false, error: 'DB_UNAVAILABLE' }, { status: 503 }),
        requestId
      )
    );
  }

  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, HEALTHCHECK_TIMEOUT_MS);
    return withNoStore(withRequestId(NextResponse.json({ ok: true }), requestId));
  } catch (error) {
    if (isTransientDbError(error)) {
      markDbDown();
      return withNoStore(
        withRequestId(
          NextResponse.json({ ok: false, error: 'DB_UNAVAILABLE' }, { status: 503 }),
          requestId
        )
      );
    }

    const res = NextResponse.json({ ok: false, error: 'DB_ERROR' }, { status: 500 });
    return withNoStore(withRequestId(res, requestId));
  }
}
