import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest, readJson, isRecord } from '@/server/http/apiUtils';
import { rateLimit } from '@/server/security/rateLimit';

export const POST = withPersonalRoute(async (ctx, req) => {
  const limited = rateLimit(req, {
    key: `personal:tx:bulk-delete:${ctx.userId}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const body = await readJson(req);
  const idsRaw =
    isRecord(body) && Array.isArray(body.ids)
      ? body.ids
      : [];

  const ids: string[] = idsRaw.map((v: unknown) => String(v));
  const numericIds: string[] = ids.filter((x: string) => /^\d+$/.test(x));

  if (numericIds.length === 0) return badRequest('No ids');

  const del = await prisma.personalTransaction.deleteMany({
    where: { userId: ctx.userId, id: { in: numericIds.map((x) => BigInt(x)) } },
  });

  return jsonb({ deleted: del.count }, ctx.requestId);
});
