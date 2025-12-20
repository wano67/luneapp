import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/server/db/client';
import { getRequestId, withRequestId } from '@/server/http/apiUtils';
import { withNoStore } from '@/server/security/csrf';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    await prisma.$queryRaw`SELECT 1`;
    return withNoStore(withRequestId(NextResponse.json({ status: 'ok' }), requestId));
  } catch (error) {
    console.error(error);
    return withNoStore(
      withRequestId(
        NextResponse.json({ status: 'error', message: 'Database not reachable' }, { status: 500 }),
        requestId
      )
    );
  }
}
