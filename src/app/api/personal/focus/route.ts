import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { rateLimit } from '@/server/security/rateLimit';
import { analyzeSavings } from '@/server/services/savingsOptimizer';

// GET /api/personal/focus
export const GET = withPersonalRoute(async (ctx, req) => {
  const limited = rateLimit(req, {
    key: `personal:focus:${ctx.userId}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const analysis = await analyzeSavings(ctx.userId);

  return jsonb(analysis, ctx.requestId);
});
