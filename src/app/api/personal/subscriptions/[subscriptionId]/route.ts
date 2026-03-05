import { prisma } from '@/server/db/client';
import { SubscriptionFrequency } from '@/generated/prisma';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound, readJson, isRecord } from '@/server/http/apiUtils';
import { parseId, parseDateOpt } from '@/server/http/parsers';
import { parseCentsInput } from '@/lib/money';

const VALID_FREQUENCIES: readonly string[] = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'];

function getSubscriptionIdFromUrl(req: Request): bigint {
  const url = new URL(req.url);
  const segments = url.pathname.split('/');
  return parseId(segments[segments.length - 1]);
}

// PATCH /api/personal/subscriptions/[subscriptionId]
export const PATCH = withPersonalRoute(async (ctx, req) => {
  const id = getSubscriptionIdFromUrl(req);

  const sub = await prisma.personalSubscription.findFirst({
    where: { id, userId: ctx.userId },
    select: { id: true },
  });
  if (!sub) return notFound('Abonnement introuvable.');

  const body = await readJson(req);
  if (!isRecord(body)) return badRequest('Payload invalide.');

  const data: Record<string, unknown> = {};

  if (typeof body.name === 'string' && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (body.amountCents != null) {
    const ac = parseCentsInput(body.amountCents);
    if (ac == null || ac <= 0) return badRequest('amountCents invalide.');
    data.amountCents = BigInt(ac);
  }
  if (body.frequency != null) {
    if (!VALID_FREQUENCIES.includes(body.frequency as string)) {
      return badRequest('frequency invalide.');
    }
    data.frequency = body.frequency as SubscriptionFrequency;
  }
  if ('startDate' in body) {
    const sd = parseDateOpt(body.startDate);
    if (!sd) return badRequest('startDate invalide.');
    data.startDate = sd;
  }
  if ('endDate' in body) {
    data.endDate = parseDateOpt(body.endDate) ?? null;
  }
  if (typeof body.isActive === 'boolean') {
    data.isActive = body.isActive;
  }
  if ('note' in body) {
    data.note = typeof body.note === 'string' ? body.note.trim() || null : null;
  }
  if ('categoryId' in body) {
    if (body.categoryId == null) {
      data.categoryId = null;
    } else {
      try {
        const cid = BigInt(String(body.categoryId));
        const cat = await prisma.personalCategory.findFirst({
          where: { id: cid, userId: ctx.userId },
          select: { id: true },
        });
        if (!cat) return badRequest('Catégorie introuvable.');
        data.categoryId = cid;
      } catch {
        return badRequest('categoryId invalide.');
      }
    }
  }

  const updated = await prisma.personalSubscription.update({
    where: { id },
    data,
    include: { category: { select: { id: true, name: true } } },
  });

  return jsonb({ item: updated }, ctx.requestId);
});

// DELETE /api/personal/subscriptions/[subscriptionId]
export const DELETE = withPersonalRoute(async (ctx, req) => {
  const id = getSubscriptionIdFromUrl(req);

  const sub = await prisma.personalSubscription.findFirst({
    where: { id, userId: ctx.userId },
    select: { id: true },
  });
  if (!sub) return notFound('Abonnement introuvable.');

  await prisma.personalSubscription.delete({ where: { id } });

  return jsonbNoContent(ctx.requestId);
});
