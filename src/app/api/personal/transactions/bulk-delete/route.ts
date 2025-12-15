import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthAsync } from '@/server/auth/requireAuth';
import { assertSameOrigin } from '@/server/security/csrf';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const { userId } = await requireAuthAsync(req);
    const body: unknown = await req.json().catch(() => ({}));

    const idsRaw =
      typeof body === 'object' && body !== null && 'ids' in body && Array.isArray((body as any).ids)
        ? ((body as any).ids as unknown[])
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
  } catch (e: any) {
    if (String(e?.message) === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
