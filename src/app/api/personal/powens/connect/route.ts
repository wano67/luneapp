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

  try {
    // 1. Créer un utilisateur Powens
    console.debug('[powens:connect] Step 1: Creating Powens user…');
    const powensUser = await powensInitUser();
    console.debug('[powens:connect] Step 1 OK: powensUserId=', powensUser.id_user);

    // 2. Chiffrer et stocker le token
    console.debug('[powens:connect] Step 2: Encrypting & storing…');
    const encrypted = encrypt(powensUser.auth_token);
    await prisma.powensConnection.create({
      data: {
        userId: ctx.userId,
        powensUserId: powensUser.id_user,
        authTokenCipher: encrypted.ciphertext,
        authTokenIv: encrypted.iv,
        authTokenTag: encrypted.tag,
      },
    });
    console.debug('[powens:connect] Step 2 OK');

    // 3. Obtenir un code temporaire pour la webview
    console.debug('[powens:connect] Step 3: Getting temp code…');
    const code = await powensGetTempCode(powensUser.auth_token);
    console.debug('[powens:connect] Step 3 OK');

    // 4. Construire l'URL de la webview
    const baseUrl = buildBaseUrl(req);
    const redirectUri = `${baseUrl}/app/personal/comptes`;
    const webviewUrl = buildPowensWebviewUrl(code, redirectUri);

    return jsonb({ webviewUrl }, ctx.requestId);
  } catch (e) {
    console.error('[powens:connect] Error:', e instanceof Error ? e.message : e);
    throw e;
  }
});
