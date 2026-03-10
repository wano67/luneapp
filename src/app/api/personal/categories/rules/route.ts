import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, notFound, readJson, isRecord } from '@/server/http/apiUtils';
import { rateLimit } from '@/server/security/rateLimit';

export const GET = withPersonalRoute(async (ctx) => {
  const items = await prisma.categoryRule.findMany({
    where: { userId: ctx.userId },
    orderBy: { priority: 'desc' },
    select: {
      id: true,
      pattern: true,
      matchType: true,
      priority: true,
      categoryId: true,
      category: { select: { id: true, name: true } },
      createdAt: true,
    },
  });

  return jsonb({ items }, ctx.requestId);
});

export const POST = withPersonalRoute(async (ctx, req) => {
  const limited = rateLimit(req, {
    key: `personal:category-rules:create:${ctx.userId}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const body = await readJson(req);
  if (!isRecord(body)) return badRequest('Payload invalide.');

  const pattern = typeof body.pattern === 'string' ? body.pattern.trim().toLowerCase() : '';
  if (!pattern) return badRequest('pattern requis.');
  if (pattern.length > 120) return badRequest('pattern trop long.');

  const VALID_MATCH_TYPES = ['CONTAINS', 'STARTS_WITH', 'EXACT'] as const;
  const matchType = typeof body.matchType === 'string' && VALID_MATCH_TYPES.includes(body.matchType as typeof VALID_MATCH_TYPES[number])
    ? body.matchType
    : 'CONTAINS';

  const priority = typeof body.priority === 'number' && Number.isFinite(body.priority)
    ? Math.round(body.priority)
    : 0;

  const categoryIdRaw = typeof body.categoryId === 'string' || typeof body.categoryId === 'number'
    ? String(body.categoryId).trim()
    : '';
  if (!categoryIdRaw) return badRequest('categoryId requis.');

  const categoryId = BigInt(categoryIdRaw);
  const cat = await prisma.personalCategory.findFirst({
    where: { id: categoryId, userId: ctx.userId },
    select: { id: true },
  });
  if (!cat) return notFound('Catégorie introuvable.');

  // Vérifier unicité du pattern
  const existing = await prisma.categoryRule.findFirst({
    where: { userId: ctx.userId, pattern },
    select: { id: true },
  });
  if (existing) return badRequest('Ce pattern existe déjà.');

  const item = await prisma.categoryRule.create({
    data: {
      userId: ctx.userId,
      categoryId,
      pattern,
      matchType,
      priority,
    },
    include: { category: { select: { id: true, name: true } } },
  });

  return jsonbCreated({ item }, ctx.requestId);
});
