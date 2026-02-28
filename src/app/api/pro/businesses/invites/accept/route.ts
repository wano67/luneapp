import crypto from 'crypto';
import { prisma } from '@/server/db/client';
import { BusinessInviteStatus } from '@/generated/prisma';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest, notFound, readJson, unauthorized } from '@/server/http/apiUtils';

function hashToken(raw: string) {
  return crypto.createHash('sha256').update(raw).digest('base64url');
}

// POST /api/pro/businesses/invites/accept
export const POST = withPersonalRoute(
  async (ctx, req) => {
    const body = await readJson(req);
    if (!body || typeof (body as Record<string, unknown>).token !== 'string') {
      return badRequest('Token requis.');
    }

    const token = ((body as Record<string, unknown>).token as string).trim();
    if (!token) return badRequest('Token invalide.');

    const tokenHash = hashToken(token);

    const invite = await prisma.businessInvite.findFirst({
      where: { OR: [{ token }, { token: tokenHash }] },
      include: { business: true },
    });

    if (!invite || !invite.business) {
      return notFound('Invitation introuvable ou déjà utilisée.');
    }

    if (invite.status !== BusinessInviteStatus.PENDING) {
      return jsonb({ error: 'Invitation non valide.' }, ctx.requestId, { status: 409 });
    }

    if (invite.expiresAt && invite.expiresAt < new Date()) {
      await prisma.businessInvite.update({
        where: { id: invite.id },
        data: { status: BusinessInviteStatus.EXPIRED },
      });
      return jsonb({ error: 'Invitation expirée.' }, ctx.requestId, { status: 409 });
    }

    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { id: true, email: true },
    });
    if (!user || !user.email) {
      return unauthorized();
    }

    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      return jsonb({ error: "Cette invitation n'est pas associée à cet utilisateur." }, ctx.requestId, { status: 403 });
    }

    const business = invite.business;

    const existing = await prisma.businessMembership.findUnique({
      where: {
        businessId_userId: { businessId: invite.businessId, userId: ctx.userId },
      },
    });

    if (existing) {
      return jsonb({ error: 'Tu es déjà membre de ce business.' }, ctx.requestId, { status: 409 });
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.businessMembership.create({
          data: {
            businessId: invite.businessId,
            userId: ctx.userId,
            role: invite.role,
          },
        });
        await tx.businessInvite.update({
          where: { id: invite.id },
          data: { status: BusinessInviteStatus.ACCEPTED },
        });
      });
    } catch {
      return jsonb({ error: "Impossible de valider l'invitation." }, ctx.requestId, { status: 409 });
    }

    return jsonb(
      {
        business: {
          id: business.id,
          name: business.name,
          ownerId: business.ownerId,
          createdAt: business.createdAt,
          updatedAt: business.updatedAt,
        },
        role: invite.role,
      },
      ctx.requestId
    );
  }
);
