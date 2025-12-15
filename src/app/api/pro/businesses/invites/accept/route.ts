import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { AUTH_COOKIE_NAME } from '@/server/auth/auth.service';
import { verifyAuthToken } from '@/server/auth/jwt';
import { BusinessInviteStatus } from '@/generated/prisma/client';
import { assertSameOrigin, jsonNoStore } from '@/server/security/csrf';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

async function getUserId(request: NextRequest): Promise<bigint | null> {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await verifyAuthToken(token);
    if (!payload.sub) return null;
    return BigInt(payload.sub);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const userId = await getUserId(request);
  if (!userId) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body || typeof body.token !== 'string') {
    return badRequest('Token requis.');
  }

  const token = body.token.trim();
  if (!token) return badRequest('Token invalide.');

  const invite = await prisma.businessInvite.findUnique({
    where: { token },
  });

  if (!invite) {
    return badRequest('Invitation introuvable ou déjà utilisée.');
  }

  if (invite.status !== BusinessInviteStatus.PENDING) {
    return badRequest('Invitation non valide.');
  }

  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return badRequest('Invitation expirée.');
  }

  const existing = await prisma.businessMembership.findUnique({
    where: {
      businessId_userId: { businessId: invite.businessId, userId },
    },
  });

  if (!existing) {
    await prisma.businessMembership.create({
      data: {
        businessId: invite.businessId,
        userId,
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
    return NextResponse.json(
      { error: 'Entreprise associée introuvable.' },
      { status: 404 }
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
