import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, readJson, isRecord } from '@/server/http/apiUtils';
import { rateLimit } from '@/server/security/rateLimit';

export const GET = withPersonalRoute(async (ctx) => {
  const items = await prisma.personalCategory.findMany({
    where: { userId: ctx.userId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, icon: true, color: true },
  });

  return jsonb({ items }, ctx.requestId);
});

// POST /api/personal/categories
export const POST = withPersonalRoute(async (ctx, req) => {
  const limited = rateLimit(req, {
    key: `personal:categories:create:${ctx.userId}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const body = await readJson(req);
  if (!isRecord(body)) return badRequest('Payload invalide.');

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return badRequest('name requis.');

  const existing = await prisma.personalCategory.findFirst({
    where: { userId: ctx.userId, name },
    select: { id: true },
  });
  if (existing) return badRequest('Cette catégorie existe déjà.');

  const icon = typeof body.icon === 'string' ? body.icon.trim() || null : null;
  const color = typeof body.color === 'string' ? body.color.trim() || null : null;

  const item = await prisma.personalCategory.create({
    data: { userId: ctx.userId, name, icon, color },
  });

  return jsonbCreated({ item }, ctx.requestId);
});
