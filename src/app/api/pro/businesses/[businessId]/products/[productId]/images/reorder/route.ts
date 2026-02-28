import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound, readJson } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';

// Reorder (accepts POST or PATCH for flexibility)
const handleReorder = withBusinessRoute<{ businessId: string; productId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:products:images:reorder:${ctx.businessId}:${ctx.userId}`,
      limit: 200,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req, params) => {
    const productId = parseId(params.productId);

    const body = await readJson(req);
    const hasArray = Array.isArray((body as Record<string, unknown>)?.orderedIds);
    const orderedIds = hasArray
      ? ((body as Record<string, unknown>).orderedIds as unknown[]).filter((id): id is string => typeof id === 'string' && /^\d+$/.test(id))
      : null;
    if (!orderedIds || orderedIds.length === 0 || orderedIds.length !== ((body as Record<string, unknown>)?.orderedIds as unknown[] | undefined)?.length) {
      return badRequest('orderedIds requis (array de string ids).');
    }

    const idList: bigint[] = orderedIds.map((id: string) => BigInt(id));
    const images = await prisma.productImage.findMany({
      where: { businessId: ctx.businessId, productId, id: { in: idList } },
      select: { id: true },
    });
    if (images.length !== orderedIds.length) return notFound('Images invalides.');

    await prisma.$transaction(
      orderedIds.map((id: string, idx: number) =>
        prisma.productImage.update({ where: { id: BigInt(id) }, data: { position: idx } })
      )
    );

    return jsonbNoContent(ctx.requestId);
  }
);

export const PATCH = handleReorder;
export const POST = handleReorder;
