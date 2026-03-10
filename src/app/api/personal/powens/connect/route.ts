import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { rateLimit } from '@/server/security/rateLimit';
import { encrypt } from '@/server/crypto/encryption';
import { buildBaseUrl } from '@/server/http/baseUrl';
import {
  powensInitUser,
  powensGetTempCode,
  buildPowensWebviewUrl,
} from '@/server/services/powens';

export const POST = withPersonalRoute(async (ctx, req) => {
  const limited = rateLimit(req, {
    key: `personal:powens:connect:${ctx.userId}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  // Vérifier qu'il n'y a pas déjà une connexion
  const existing = await prisma.powensConnection.findUnique({
    where: { userId: ctx.userId },
  });
  if (existing) {
    return jsonb({ error: 'Connexion Powens déjà active' }, ctx.requestId, { status: 409 });
  }

  // 1. Créer un utilisateur Powens
  const powensUser = await powensInitUser();

  // 2. Chiffrer et stocker le token
  const encrypted = encrypt(powensUser.auth_token);
  await prisma.powensConnection.create({
    data: {
      userId: ctx.userId,
      powensUserId: powensUser.id,
      authTokenCipher: encrypted.ciphertext,
      authTokenIv: encrypted.iv,
      authTokenTag: encrypted.tag,
    },
  });

  // 3. Obtenir un code temporaire pour la webview
  const code = await powensGetTempCode(powensUser.auth_token);

  // 4. Construire l'URL de la webview
  // Le redirect URI doit matcher celui enregistré dans le dashboard Powens
  const baseUrl = buildBaseUrl(req);
  const redirectUri = `${baseUrl}/app/personal/comptes`;
  const webviewUrl = buildPowensWebviewUrl(code, redirectUri);

  return jsonb({ webviewUrl }, ctx.requestId);
});
