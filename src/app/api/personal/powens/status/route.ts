import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { decrypt } from '@/server/crypto/encryption';
import { powensGetConnections } from '@/server/services/powens';

export const GET = withPersonalRoute(async (ctx) => {
  const conn = await prisma.powensConnection.findUnique({
    where: { userId: ctx.userId },
  });

  if (!conn) {
    return jsonb({ connected: false }, ctx.requestId);
  }

  // Compter les comptes synchronisés
  const accountCount = await prisma.personalAccount.count({
    where: { userId: ctx.userId, powensAccountId: { not: null }, powensDisabled: false },
  });

  // Récupérer l'état des connexions bancaires
  let connections: Array<{ id: number; state: string; bankName: string | null }> = [];
  try {
    const authToken = decrypt(conn.authTokenCipher, conn.authTokenIv, conn.authTokenTag);
    const rawConns = await powensGetConnections(authToken);
    connections = rawConns.map((c) => ({
      id: c.id,
      state: c.state,
      bankName: c.connector?.name || null,
    }));
  } catch {
    // Si le token est invalide, on signale quand même connected: true
  }

  return jsonb({
    connected: true,
    lastSyncAt: conn.lastSyncAt?.toISOString() || null,
    accountCount,
    connections,
  }, ctx.requestId);
});
