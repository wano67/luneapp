import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { rateLimit } from '@/server/security/rateLimit';
import { bulkAutoCategorize } from '@/server/services/autoCategorize';

export const POST = withPersonalRoute(async (ctx, req) => {
  const limited = rateLimit(req, {
    key: `personal:auto-categorize:${ctx.userId}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const categorized = await bulkAutoCategorize(ctx.userId);

  return jsonb({ categorized }, ctx.requestId);
});
