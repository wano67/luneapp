import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthAsync } from '@/server/auth/requireAuth';
import { jsonNoStore } from '@/server/security/csrf';
import { getRequestId, withRequestId } from '@/server/http/apiUtils';

function toStrId(v: bigint) {
  return v.toString();
}

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const { userId } = await requireAuthAsync(req);

    const items = await prisma.personalCategory.findMany({
      where: { userId: BigInt(userId) },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });

    return withRequestId(
      jsonNoStore({
        items: items.map((c) => ({
          id: toStrId(c.id),
          name: c.name,
        })),
      }),
      requestId
    );
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return withRequestId(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), requestId);
    }
    console.error(e);
    return withRequestId(NextResponse.json({ error: 'Failed' }, { status: 500 }), requestId);
  }
}
