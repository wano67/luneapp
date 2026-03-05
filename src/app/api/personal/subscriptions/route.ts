import { prisma } from '@/server/db/client';
import { SubscriptionFrequency } from '@/generated/prisma';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, readJson, isRecord } from '@/server/http/apiUtils';
import { rateLimit } from '@/server/security/rateLimit';
import { parseCentsInput } from '@/lib/money';
import { parseDateOpt } from '@/server/http/parsers';

const VALID_FREQUENCIES: readonly string[] = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'];

// GET /api/personal/subscriptions
export const GET = withPersonalRoute(async (ctx) => {
  const items = await prisma.personalSubscription.findMany({
    where: { userId: ctx.userId },
    orderBy: { createdAt: 'desc' },
    include: { category: { select: { id: true, name: true } } },
  });

  return jsonb({ items }, ctx.requestId);
});

// POST /api/personal/subscriptions
export const POST = withPersonalRoute(async (ctx, req) => {
  const limited = rateLimit(req, {
    key: `personal:subscriptions:create:${ctx.userId}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const body = await readJson(req);
  if (!isRecord(body)) return badRequest('Payload invalide.');

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return badRequest('name requis.');

  const amountCents = parseCentsInput(body.amountCents);
  if (amountCents == null || amountCents <= 0) return badRequest('amountCents requis et > 0.');

  const freq = typeof body.frequency === 'string' ? body.frequency : '';
  if (!VALID_FREQUENCIES.includes(freq)) {
    return badRequest('frequency invalide (WEEKLY, MONTHLY, QUARTERLY, YEARLY).');
  }
  const frequency = freq as SubscriptionFrequency;

  const startDate = parseDateOpt(body.startDate);
  if (!startDate) return badRequest('startDate requis.');

  const endDate = parseDateOpt(body.endDate) ?? null;

  let categoryId: bigint | null = null;
  if (body.categoryId != null) {
    try {
      categoryId = BigInt(String(body.categoryId));
      const cat = await prisma.personalCategory.findFirst({
        where: { id: categoryId, userId: ctx.userId },
        select: { id: true },
      });
      if (!cat) return badRequest('Catégorie introuvable.');
    } catch {
      return badRequest('categoryId invalide.');
    }
  }

  const note = typeof body.note === 'string' ? body.note.trim() || null : null;

  const item = await prisma.personalSubscription.create({
    data: {
      userId: ctx.userId,
      name,
      amountCents: BigInt(amountCents),
      frequency,
      startDate,
      endDate,
      categoryId,
      note,
      isActive: true,
    },
    include: { category: { select: { id: true, name: true } } },
  });

  return jsonbCreated({ item }, ctx.requestId);
});
