import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonbNoContent } from '@/server/http/json';
import { rateLimit } from '@/server/security/rateLimit';
import { decrypt } from '@/server/crypto/encryption';
import { powensDeleteUser } from '@/server/services/powens';

export const DELETE = withPersonalRoute(async (ctx, req) => {
  const limited = rateLimit(req, {
    key: `personal:powens:disconnect:${ctx.userId}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const conn = await prisma.powensConnection.findUnique({
    where: { userId: ctx.userId },
  });
  if (!conn) {
    return jsonbNoContent(ctx.requestId);
  }

  // Supprimer l'utilisateur côté Powens
  try {
    const authToken = decrypt(conn.authTokenCipher, conn.authTokenIv, conn.authTokenTag);
    await powensDeleteUser(authToken);
  } catch (e) {
    console.error('[powens] Erreur suppression utilisateur Powens:', e);
    // On continue quand même pour nettoyer notre DB
  }

  // Marquer les comptes comme déconnectés
  await prisma.personalAccount.updateMany({
    where: { userId: ctx.userId, powensAccountId: { not: null } },
    data: { powensDisabled: true },
  });

  // Supprimer la connexion locale
  await prisma.powensConnection.delete({ where: { userId: ctx.userId } });

  return jsonbNoContent(ctx.requestId);
});
