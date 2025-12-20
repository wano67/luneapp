import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthAsync } from '@/server/auth/requireAuth';
import { assertSameOrigin } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import { getRequestId, withRequestId } from '@/server/http/apiUtils';
import { withNoStore, jsonNoStore } from '@/server/security/csrf';

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

function withIdNoStore(res: NextResponse, requestId: string) {
  return withNoStore(withRequestId(res, requestId));
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  const csrf = assertSameOrigin(req);
  if (csrf) return withIdNoStore(csrf, requestId);

  try {
    const { userId } = await requireAuthAsync(req);
    const limited = rateLimit(req, {
      key: `personal:tx:bulk-delete:${userId}`,
      limit: 30,
      windowMs: 10 * 60 * 1000,
    });
    if (limited) return withIdNoStore(limited, requestId);
    const body: unknown = await req.json().catch(() => null);
    const idsRaw =
      isRecord(body) && Array.isArray(body.ids)
        ? body.ids
        : [];

    const ids: string[] = idsRaw.map((v) => String(v));
    const numericIds: string[] = ids.filter((x: string) => /^\d+$/.test(x));

    if (numericIds.length === 0) {
      return withIdNoStore(NextResponse.json({ error: 'No ids' }, { status: 400 }), requestId);
    }

    const del = await prisma.personalTransaction.deleteMany({
      where: { userId: BigInt(userId), id: { in: numericIds.map((x) => BigInt(x)) } },
    });

    return withIdNoStore(jsonNoStore({ deleted: del.count }), requestId);
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return withIdNoStore(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), requestId);
    }
    return withIdNoStore(NextResponse.json({ error: 'Failed' }, { status: 500 }), requestId);
  }
}
