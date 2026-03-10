import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest, readJson, isRecord } from '@/server/http/apiUtils';
import { rateLimit } from '@/server/security/rateLimit';
import { decrypt } from '@/server/crypto/encryption';
import { buildBaseUrl } from '@/server/http/baseUrl';
import { powensGetTempCode, buildPowensReconnectUrl } from '@/server/services/powens';

export const POST = withPersonalRoute(async (ctx, req) => {
  const limited = rateLimit(req, {
    key: `personal:powens:reconnect:${ctx.userId}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const body = await readJson(req);
  if (!isRecord(body) || typeof body.connectionId !== 'number') {
    return badRequest('connectionId (number) requis');
  }

  const conn = await prisma.powensConnection.findUnique({
    where: { userId: ctx.userId },
  });
  if (!conn) {
    return jsonb({ error: 'Aucune connexion Powens' }, ctx.requestId, { status: 404 });
  }

  const authToken = decrypt(conn.authTokenCipher, conn.authTokenIv, conn.authTokenTag);
  const code = await powensGetTempCode(authToken);

  const baseUrl = buildBaseUrl(req);
  const redirectUri = `${baseUrl}/app/personal/comptes`;
  const webviewUrl = buildPowensReconnectUrl(code, body.connectionId as number, redirectUri);

  return jsonb({ webviewUrl }, ctx.requestId);
});
