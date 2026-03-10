import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound, readJson, isRecord } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';

function getCategoryIdFromUrl(req: Request): bigint {
  const url = new URL(req.url);
  const segments = url.pathname.split('/');
  return parseId(segments[segments.length - 1]);
}

// PATCH /api/personal/categories/[categoryId]
export const PATCH = withPersonalRoute(async (ctx, req) => {
  const id = getCategoryIdFromUrl(req);

  const cat = await prisma.personalCategory.findFirst({
    where: { id, userId: ctx.userId },
    select: { id: true },
  });
  if (!cat) return notFound('Catégorie introuvable.');

  const body = await readJson(req);
  if (!isRecord(body)) return badRequest('Payload invalide.');

  const data: Record<string, unknown> = {};

  if (typeof body.name === 'string') {
    const name = body.name.trim();
    if (!name) return badRequest('name requis.');
    const duplicate = await prisma.personalCategory.findFirst({
      where: { userId: ctx.userId, name, id: { not: id } },
      select: { id: true },
    });
    if (duplicate) return badRequest('Cette catégorie existe déjà.');
    data.name = name;
  }

  if (body.icon !== undefined) {
    data.icon = typeof body.icon === 'string' ? body.icon.trim() || null : null;
  }
  if (body.color !== undefined) {
    data.color = typeof body.color === 'string' ? body.color.trim() || null : null;
  }

  if (Object.keys(data).length === 0) return badRequest('Aucun champ à modifier.');

  const updated = await prisma.personalCategory.update({
    where: { id },
    data,
  });

  return jsonb({ item: updated }, ctx.requestId);
});

// DELETE /api/personal/categories/[categoryId]
export const DELETE = withPersonalRoute(async (ctx, req) => {
  const id = getCategoryIdFromUrl(req);

  const cat = await prisma.personalCategory.findFirst({
    where: { id, userId: ctx.userId },
    select: { id: true },
  });
  if (!cat) return notFound('Catégorie introuvable.');

  await prisma.personalCategory.delete({ where: { id } });

  return jsonbNoContent(ctx.requestId);
});
