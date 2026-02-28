import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { notFound } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';

// POST /api/pro/businesses/{businessId}/projects/{projectId}/archive
export const POST = withBusinessRoute<{ businessId: string; projectId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:projects:archive:${ctx.businessId}:${ctx.userId}`,
      limit: 60,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, _req, params) => {
    const projectId = parseId(params.projectId);

    const project = await prisma.project.findFirst({
      where: { id: projectId, businessId: ctx.businessId },
    });
    if (!project) return notFound('Projet introuvable.');

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: { archivedAt: new Date() },
    });

    return jsonb(
      {
        id: updated.id,
        archivedAt: updated.archivedAt,
      },
      ctx.requestId
    );
  }
);
