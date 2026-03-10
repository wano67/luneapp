import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { rateLimit } from '@/server/security/rateLimit';
import { syncPowensData } from '@/server/services/powensSync';

export const POST = withPersonalRoute(async (ctx, req) => {
  const limited = rateLimit(req, {
    key: `personal:powens:sync:${ctx.userId}`,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const result = await syncPowensData(ctx.userId);

  return jsonb({
    accountsSynced: result.accountsSynced,
    transactionsAdded: result.transactionsAdded,
  }, ctx.requestId);
});
