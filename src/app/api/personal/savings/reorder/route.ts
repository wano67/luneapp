import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest, readJson, isRecord } from '@/server/http/apiUtils';
import { rateLimit } from '@/server/security/rateLimit';

// PATCH /api/personal/savings/reorder
export const PATCH = withPersonalRoute(async (ctx, req) => {
  const limited = rateLimit(req, {
    key: `personal:savings:reorder:${ctx.userId}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const body = await readJson(req);
  if (!isRecord(body)) return badRequest('Payload invalide.');

  const itemsRaw = body.items;
  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
    return badRequest('items requis.');
  }

  const updates: Array<{ id: bigint; priority: number }> = [];
  for (const raw of itemsRaw) {
    if (!raw || typeof raw !== 'object') return badRequest('item invalide.');
    const r = raw as Record<string, unknown>;
    const idStr = typeof r.id === 'string' ? r.id : typeof r.id === 'number' ? String(r.id) : null;
    if (!idStr || !/^\d+$/.test(idStr)) return badRequest('item.id invalide.');
    const prio = typeof r.priority === 'number' && Number.isFinite(r.priority)
      ? Math.max(0, Math.trunc(r.priority))
      : 0;
    updates.push({ id: BigInt(idStr), priority: prio });
  }

  // Verify ownership
  const existing = await prisma.savingsGoal.findMany({
    where: { userId: ctx.userId, id: { in: updates.map((u) => u.id) } },
    select: { id: true },
  });
  if (existing.length !== updates.length) return badRequest('Objectifs introuvables.');

  await prisma.$transaction(
    updates.map((u) =>
      prisma.savingsGoal.update({ where: { id: u.id }, data: { priority: u.priority } }),
    ),
  );

  return jsonb({ ok: true }, ctx.requestId);
});
