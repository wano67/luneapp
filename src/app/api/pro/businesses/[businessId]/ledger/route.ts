import { LedgerSourceType } from '@/generated/prisma';
import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest } from '@/server/http/apiUtils';

function parseIdSoft(param: string | null) {
  if (!param || !/^\d+$/.test(param)) return null;
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

// GET /api/pro/businesses/{businessId}/ledger
export const GET = withBusinessRoute({ minRole: 'VIEWER' }, async (ctx, req) => {
  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const sourceTypeParam = searchParams.get('sourceType');
  const sourceIdParam = searchParams.get('sourceId');
  const cursorParam = searchParams.get('cursor');
  const limitParam = searchParams.get('limit');

  const fromDate = fromParam ? new Date(fromParam) : null;
  const toDate = toParam ? new Date(toParam) : null;
  if (fromParam && Number.isNaN(fromDate?.getTime() ?? NaN)) {
    return badRequest('from invalide.');
  }
  if (toParam && Number.isNaN(toDate?.getTime() ?? NaN)) {
    return badRequest('to invalide.');
  }

  const sourceType = sourceTypeParam && Object.values(LedgerSourceType).includes(sourceTypeParam as LedgerSourceType)
    ? (sourceTypeParam as LedgerSourceType)
    : null;
  const sourceId = parseIdSoft(sourceIdParam);
  if (sourceIdParam && !sourceId) {
    return badRequest('sourceId invalide.');
  }
  const cursor = parseIdSoft(cursorParam);
  const take = Math.min(100, Math.max(1, Number(limitParam ?? 50) || 50));

  const entries = await prisma.ledgerEntry.findMany({
    where: {
      businessId: ctx.businessId,
      ...(fromDate || toDate
        ? {
            date: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
      ...(sourceType ? { sourceType } : {}),
      ...(sourceId ? { sourceId } : {}),
      ...(cursor ? { id: { lt: cursor } } : {}),
    },
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    take,
    include: { lines: true },
  });

  return jsonb(
    {
      items: entries,
      nextCursor: entries.length === take ? entries[entries.length - 1].id : null,
    },
    ctx.requestId
  );
});
