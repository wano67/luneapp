import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthAsync } from '@/server/auth/requireAuth';
import { jsonNoStore } from '@/server/security/csrf';

function toStrId(v: bigint) {
  return v.toString();
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuthAsync(req);

    const items = await prisma.personalCategory.findMany({
      where: { userId: BigInt(userId) },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });

    return jsonNoStore({
      items: items.map((c) => ({
        id: toStrId(c.id),
        name: c.name,
      })),
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
