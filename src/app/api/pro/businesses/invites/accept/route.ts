import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { BusinessInviteStatus } from '@/generated/prisma/client';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { badRequest, getRequestId, notFound, unauthorized, withRequestId } from '@/server/http/apiUtils';

function withIdNoStore(res: NextResponse, requestId: string) {
  return withNoStore(withRequestId(res, requestId));
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  let userId: string | null = null;
  try {
    const auth = await requireAuthPro(request);
    userId = auth.userId;
  } catch {
    userId = null;
  }
  const limited = rateLimit(request, {
    key: userId
      ? `pro:invites:accept:${userId.toString()}`
      : makeIpKey(request, 'pro:invites:accept'),
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);
  if (!userId) return withIdNoStore(unauthorized(), requestId);

  const body = await request.json().catch(() => null);
  if (!body || typeof body.token !== 'string') {
    return withIdNoStore(badRequest('Token requis.'), requestId);
  }

  const token = body.token.trim();
  if (!token) return withIdNoStore(badRequest('Token invalide.'), requestId);

  const invite = await prisma.businessInvite.findUnique({
    where: { token },
    include: { business: true },
  });

  if (!invite || !invite.business) {
    return withIdNoStore(notFound('Invitation introuvable ou déjà utilisée.'), requestId);
  }

  if (invite.status !== BusinessInviteStatus.PENDING) {
    return withIdNoStore(jsonNoStore({ error: 'Invitation non valide.' }, { status: 409 }), requestId);
  }

  if (invite.expiresAt && invite.expiresAt < new Date()) {
    await prisma.businessInvite.update({
      where: { id: invite.id },
      data: { status: BusinessInviteStatus.EXPIRED },
    });
    return withIdNoStore(jsonNoStore({ error: 'Invitation expirée.' }, { status: 409 }), requestId);
  }

  const userIdBigInt = BigInt(userId);
  const user = await prisma.user.findUnique({
    where: { id: userIdBigInt },
    select: { id: true, email: true },
  });
  if (!user || !user.email) {
    return withIdNoStore(unauthorized(), requestId);
  }

  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    return withIdNoStore(
      jsonNoStore({ error: "Cette invitation n'est pas associée à cet utilisateur." }, { status: 403 }),
      requestId
    );
  }

  const business = invite.business;

  const existing = await prisma.businessMembership.findUnique({
    where: {
      businessId_userId: { businessId: invite.businessId, userId: userIdBigInt },
    },
  });

  if (existing) {
    return withIdNoStore(
      jsonNoStore({ error: 'Tu es déjà membre de ce business.' }, { status: 409 }),
      requestId
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.businessMembership.create({
        data: {
          businessId: invite.businessId,
          userId: userIdBigInt,
          role: invite.role,
        },
      });
      await tx.businessInvite.update({
        where: { id: invite.id },
        data: { status: BusinessInviteStatus.ACCEPTED },
      });
    });
  } catch (error) {
    console.error({ requestId, route: '/api/pro/businesses/invites/accept', error });
    return withIdNoStore(
      jsonNoStore({ error: "Impossible de valider l'invitation." }, { status: 409 }),
      requestId
    );
  }

  return withIdNoStore(
    jsonNoStore({
      business: {
        id: business.id.toString(),
        name: business.name,
        ownerId: business.ownerId.toString(),
        createdAt: business.createdAt.toISOString(),
        updatedAt: business.updatedAt.toISOString(),
      },
      role: invite.role,
    }),
    requestId
  );
}
