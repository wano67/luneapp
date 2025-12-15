import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { BusinessInviteStatus } from '@/generated/prisma/client';
import { assertSameOrigin, jsonNoStore } from '@/server/security/csrf';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import {
  badRequest,
  getRequestId,
  unauthorized,
  withRequestId,
} from '@/server/http/apiUtils';

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  let userIdForKey: string | null = null;
  try {
    const auth = await requireAuthPro(request);
    userIdForKey = auth.userId;
  } catch {
    userIdForKey = null;
  }
  const limited = rateLimit(request, {
    key: userIdForKey
      ? `pro:invites:accept:${userIdForKey.toString()}`
      : makeIpKey(request, 'pro:invites:accept'),
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withRequestId(unauthorized(), requestId);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.token !== 'string') {
    return withRequestId(badRequest('Token requis.'), requestId);
  }

  const token = body.token.trim();
  if (!token) return withRequestId(badRequest('Token invalide.'), requestId);

  const invite = await prisma.businessInvite.findUnique({
    where: { token },
  });

  if (!invite) {
    return withRequestId(badRequest('Invitation introuvable ou déjà utilisée.'), requestId);
  }

  if (invite.status !== BusinessInviteStatus.PENDING) {
    return withRequestId(badRequest('Invitation non valide.'), requestId);
  }

  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return withRequestId(badRequest('Invitation expirée.'), requestId);
  }

  const userIdBigInt = BigInt(userId);

  const existing = await prisma.businessMembership.findUnique({
    where: {
      businessId_userId: { businessId: invite.businessId, userId: userIdBigInt },
    },
  });

  if (!existing) {
    await prisma.businessMembership.create({
      data: {
        businessId: invite.businessId,
        userId: userIdBigInt,
        role: invite.role,
      },
    });
  }

  await prisma.businessInvite.update({
    where: { id: invite.id },
    data: {
      status: BusinessInviteStatus.ACCEPTED,
    },
  });

  const business = await prisma.business.findUnique({
    where: { id: invite.businessId },
  });

  if (!business) {
    return withRequestId(
      NextResponse.json({ error: 'Entreprise associée introuvable.' }, { status: 404 }),
      requestId
    );
  }

  return jsonNoStore({
    business: {
      id: business.id.toString(),
      name: business.name,
      ownerId: business.ownerId.toString(),
      createdAt: business.createdAt.toISOString(),
      updatedAt: business.updatedAt.toISOString(),
    },
    role: invite.role,
  });
}
