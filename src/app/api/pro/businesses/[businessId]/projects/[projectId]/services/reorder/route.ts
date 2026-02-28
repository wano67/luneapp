import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest, readJson } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';

// PATCH /api/pro/businesses/{businessId}/projects/{projectId}/services/reorder
export const PATCH = withBusinessRoute<{ businessId: string; projectId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:project-services:reorder:${ctx.businessId}:${ctx.userId}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req, params) => {
    const projectId = parseId(params.projectId);

    const body = await readJson(req);
    if (!body || typeof body !== 'object') {
      return badRequest('Payload invalide.');
    }

    const itemsRaw = (body as { items?: unknown }).items;
    if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
      return badRequest('items invalide.');
    }

    const updates: Array<{ id: bigint; position: number }> = [];
    for (const raw of itemsRaw) {
      if (!raw || typeof raw !== 'object') return badRequest('items invalide.');
      const idRaw = (raw as { id?: unknown }).id;
      const posRaw = (raw as { position?: unknown }).position;
      if (typeof idRaw !== 'string' || !/^\d+$/.test(idRaw)) {
        return badRequest('item.id invalide.');
      }
      if (typeof posRaw !== 'number' || !Number.isFinite(posRaw)) {
        return badRequest('item.position invalide.');
      }
      const position = Math.max(0, Math.trunc(posRaw));
      updates.push({ id: BigInt(idRaw), position });
    }

    const existing = await prisma.projectService.findMany({
      where: { projectId, project: { businessId: ctx.businessId }, id: { in: updates.map((u) => u.id) } },
      select: { id: true },
    });
    if (existing.length !== updates.length) {
      return badRequest('Services introuvables pour ce projet.');
    }

    await prisma.$transaction(
      updates.map((u) =>
        prisma.projectService.update({
          where: { id: u.id },
          data: { position: u.position },
        })
      )
    );

    return jsonb({ ok: true }, ctx.requestId);
  }
);
