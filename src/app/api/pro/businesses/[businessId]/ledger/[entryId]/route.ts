import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { notFound } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';

// GET /api/pro/businesses/{businessId}/ledger/{entryId}
export const GET = withBusinessRoute<{ businessId: string; entryId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _req, params) => {
    const entryId = parseId(params.entryId);

    const entry = await prisma.ledgerEntry.findFirst({
      where: { id: entryId, businessId: ctx.businessId },
      include: { lines: true },
    });
    if (!entry) return notFound('Écriture introuvable.');

    return jsonb({ item: entry }, ctx.requestId);
  }
);
