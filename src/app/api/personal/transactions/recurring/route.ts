import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { rateLimit } from '@/server/security/rateLimit';
import { detectRecurringTransactions } from '@/server/services/detectRecurring';

export const GET = withPersonalRoute(async (ctx, req) => {
  const limited = rateLimit(req, {
    key: `personal:recurring:${ctx.userId}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const candidates = await detectRecurringTransactions(ctx.userId);

  return jsonb({
    items: candidates.map((c) => ({
      label: c.label,
      estimatedAmountCents: c.estimatedAmountCents,
      estimatedFrequency: c.estimatedFrequency,
      occurrences: c.occurrences,
      lastSeen: c.lastSeen.toISOString(),
      categoryId: c.categoryId,
      categoryName: c.categoryName,
    })),
  }, ctx.requestId);
});
