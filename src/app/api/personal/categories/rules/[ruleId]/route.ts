import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound, readJson, isRecord } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';

function getRuleIdFromUrl(req: Request): bigint {
  const url = new URL(req.url);
  return parseId(url.pathname.split('/').at(-1));
}

export const PATCH = withPersonalRoute(async (ctx, req) => {
  const id = getRuleIdFromUrl(req);

  const rule = await prisma.categoryRule.findFirst({
    where: { id, userId: ctx.userId },
    select: { id: true },
  });
  if (!rule) return notFound('Règle introuvable.');

  const body = await readJson(req);
  if (!isRecord(body)) return badRequest('Payload invalide.');

  const data: Record<string, unknown> = {};

  if (typeof body.pattern === 'string') {
    const pattern = body.pattern.trim().toLowerCase();
    if (!pattern) return badRequest('pattern requis.');
    if (pattern.length > 120) return badRequest('pattern trop long.');
    // Vérifier unicité
    const dup = await prisma.categoryRule.findFirst({
      where: { userId: ctx.userId, pattern, id: { not: id } },
      select: { id: true },
    });
    if (dup) return badRequest('Ce pattern existe déjà.');
    data.pattern = pattern;
  }

  if (typeof body.matchType === 'string') {
    const VALID = ['CONTAINS', 'STARTS_WITH', 'EXACT'];
    if (!VALID.includes(body.matchType)) return badRequest('matchType invalide.');
    data.matchType = body.matchType;
  }

  if (typeof body.priority === 'number' && Number.isFinite(body.priority)) {
    data.priority = Math.round(body.priority);
  }

  if (body.categoryId !== undefined) {
    const catId = BigInt(String(body.categoryId));
    const cat = await prisma.personalCategory.findFirst({
      where: { id: catId, userId: ctx.userId },
      select: { id: true },
    });
    if (!cat) return notFound('Catégorie introuvable.');
    data.categoryId = catId;
  }

  const updated = await prisma.categoryRule.update({
    where: { id },
    data,
    include: { category: { select: { id: true, name: true } } },
  });

  return jsonb({ item: updated }, ctx.requestId);
});

export const DELETE = withPersonalRoute(async (ctx, req) => {
  const id = getRuleIdFromUrl(req);

  const rule = await prisma.categoryRule.findFirst({
    where: { id, userId: ctx.userId },
    select: { id: true },
  });
  if (!rule) return notFound('Règle introuvable.');

  await prisma.categoryRule.delete({ where: { id } });

  return jsonbNoContent(ctx.requestId);
});
