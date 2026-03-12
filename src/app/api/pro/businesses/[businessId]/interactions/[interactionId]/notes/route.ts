import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonbCreated } from '@/server/http/json';
import { badRequest, notFound, readJson, isRecord } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';

// POST /api/pro/businesses/{businessId}/interactions/{interactionId}/notes
export const POST = withBusinessRoute<{ businessId: string; interactionId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: { key: (ctx) => `pro:interaction-notes:create:${ctx.businessId}:${ctx.userId}`, limit: 300, windowMs: 3_600_000 },
  },
  async (ctx, req, params) => {
    const interactionId = parseId(params.interactionId);

    const interaction = await prisma.interaction.findFirst({
      where: { id: interactionId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!interaction) return notFound('Interaction introuvable.');

    const body = await readJson(req);
    if (!isRecord(body)) return badRequest('Payload invalide.');

    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content) return badRequest('Contenu requis.');
    if (content.length > 2000) return badRequest('Contenu trop long (2000 max).');

    const maxPos = await prisma.interactionNote.aggregate({
      where: { interactionId },
      _max: { position: true },
    });

    const note = await prisma.interactionNote.create({
      data: {
        interactionId,
        content,
        position: (maxPos._max.position ?? -1) + 1,
      },
    });

    return jsonbCreated({ item: note }, ctx.requestId);
  }
);
