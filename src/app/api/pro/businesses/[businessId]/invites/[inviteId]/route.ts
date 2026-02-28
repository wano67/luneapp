import { prisma } from '@/server/db/client';
import { BusinessInviteStatus } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { notFound } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';

// DELETE /api/pro/businesses/{businessId}/invites/{inviteId}
export const DELETE = withBusinessRoute<{ businessId: string; inviteId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: { key: (ctx) => `pro:invites:delete:${ctx.businessId}:${ctx.userId}`, limit: 60, windowMs: 60 * 60 * 1000 },
  },
  async (ctx, _req, params) => {
    const inviteId = parseId(params.inviteId);

    const business = await prisma.business.findUnique({ where: { id: ctx.businessId } });
    if (!business) return notFound('Entreprise introuvable.');

    const invite = await prisma.businessInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite || invite.businessId !== ctx.businessId) {
      return notFound('Invitation non trouvée.');
    }

    const now = new Date();
    if (invite.expiresAt && invite.expiresAt < now && invite.status === BusinessInviteStatus.PENDING) {
      await prisma.businessInvite.update({
        where: { id: inviteId },
        data: { status: BusinessInviteStatus.EXPIRED },
      });
      return jsonb({ error: 'Invitation expirée.' }, ctx.requestId, { status: 409 });
    }

    if (invite.status !== BusinessInviteStatus.PENDING) {
      return jsonb({ error: 'Invitation déjà utilisée ou révoquée.' }, ctx.requestId, { status: 409 });
    }

    await prisma.businessInvite.update({
      where: { id: inviteId },
      data: { status: BusinessInviteStatus.REVOKED },
    });

    return jsonbNoContent(ctx.requestId);
  }
);
