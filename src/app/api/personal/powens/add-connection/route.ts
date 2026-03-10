import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { rateLimit } from '@/server/security/rateLimit';
import { decrypt } from '@/server/crypto/encryption';
import { buildBaseUrl } from '@/server/http/baseUrl';
import { powensGetTempCode, buildPowensWebviewUrl } from '@/server/services/powens';

/**
 * Ajouter une nouvelle banque pour un utilisateur déjà connecté à Powens.
 * Réutilise le token existant pour obtenir un code temporaire et rediriger vers la webview.
 */
export const POST = withPersonalRoute(async (ctx, req) => {
  const limited = rateLimit(req, {
    key: `personal:powens:add-connection:${ctx.userId}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

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
  const webviewUrl = buildPowensWebviewUrl(code, redirectUri);

  return jsonb({ webviewUrl }, ctx.requestId);
});
