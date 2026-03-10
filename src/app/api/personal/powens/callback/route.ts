import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest, readJson, isRecord } from '@/server/http/apiUtils';
import { rateLimit } from '@/server/security/rateLimit';
import { syncPowensData } from '@/server/services/powensSync';

export const POST = withPersonalRoute(async (ctx, req) => {
  const limited = rateLimit(req, {
    key: `personal:powens:callback:${ctx.userId}`,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const body = await readJson(req);
  if (!isRecord(body)) return badRequest('Body invalide');

  // Vérifier que la connexion existe
  const conn = await prisma.powensConnection.findUnique({
    where: { userId: ctx.userId },
  });
  if (!conn) {
    return jsonb({ error: 'Aucune connexion Powens' }, ctx.requestId, { status: 404 });
  }

  // Synchroniser les données
  const result = await syncPowensData(ctx.userId);

  return jsonb({
    accountsSynced: result.accountsSynced,
    transactionsAdded: result.transactionsAdded,
  }, ctx.requestId);
});
