import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthAsync } from '@/server/auth/requireAuth';
import { assertSameOrigin } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const { userId } = await requireAuthAsync(req);
    const limited = rateLimit(req, {
      key: `personal:tx:bulk-delete:${userId}`,
      limit: 30,
      windowMs: 10 * 60 * 1000,
    });
    if (limited) return limited;
    const body: unknown = await req.json().catch(() => null);
    const idsRaw =
      isRecord(body) && Array.isArray(body.ids)
        ? body.ids
        : [];

    const ids: string[] = idsRaw.map((v) => String(v));
    const numericIds: string[] = ids.filter((x: string) => /^\d+$/.test(x));

    if (numericIds.length === 0) {
      return NextResponse.json({ error: 'No ids' }, { status: 400 });
    }

    const del = await prisma.personalTransaction.deleteMany({
      where: { userId: BigInt(userId), id: { in: numericIds.map((x) => BigInt(x)) } },
    });

    return NextResponse.json({ deleted: del.count });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
