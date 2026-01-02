import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/server/db/client';
import { getRequestId, withRequestId } from '@/server/http/apiUtils';
import { withNoStore } from '@/server/security/csrf';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const dbUrl = process.env.DATABASE_URL?.trim();

  if (!dbUrl) {
    return withNoStore(
      withRequestId(NextResponse.json({ status: 'ok', db: 'disabled' }), requestId)
    );
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return withNoStore(withRequestId(NextResponse.json({ status: 'ok', db: 'ok' }), requestId));
  } catch (error) {
    console.error('healthcheck db failure', error);
    return withNoStore(
      withRequestId(
        NextResponse.json(
          { status: 'error', db: 'error', message: 'Database not reachable' },
          { status: 503 }
        ),
        requestId
      )
    );
  }
}
