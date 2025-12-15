import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { AUTH_COOKIE_NAME } from '@/server/auth/auth.service';
import { verifyAuthToken } from '@/server/auth/jwt';
import { BusinessRole, BusinessInviteStatus } from '@/generated/prisma/client';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, getAllowedOrigins, jsonNoStore } from '@/server/security/csrf';
import crypto from 'crypto';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) {
    return null;
  }
  try {
    return BigInt(param);
  } catch {
    return null;
  }
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

// GET /api/pro/businesses/{businessId}/invites
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await context.params;

  const userId = await getUserId(request);
  if (!userId) return unauthorized();

  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) {
    return badRequest('businessId invalide.');
  }

  const membership = await requireBusinessRole(businessIdBigInt, userId, 'ADMIN');
  if (!membership) return forbidden();

  const invites = await prisma.businessInvite.findMany({
    where: { businessId: businessIdBigInt },
    orderBy: { createdAt: 'desc' },
  });

  return jsonNoStore({
    items: invites.map((inv) => ({
      id: inv.id.toString(),
      businessId: inv.businessId.toString(),
      email: inv.email,
      role: inv.role,
      status: inv.status,
      createdAt: inv.createdAt.toISOString(),
      expiresAt: inv.expiresAt ? inv.expiresAt.toISOString() : null,
    })),
  });
}

// POST /api/pro/businesses/{businessId}/invites
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await context.params;

  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const userIdForRate = await getUserId(request);
  const limited = rateLimit(request, {
    key: userIdForRate
      ? `pro:invites:create:${businessId}:${userIdForRate.toString()}`
      : makeIpKey(request, `pro:invites:create:${businessId}`),
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const userId = userIdForRate;
  if (!userId) return unauthorized();

  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) {
    return badRequest('businessId invalide.');
  }
  const membership = await requireBusinessRole(businessIdBigInt, userId, 'ADMIN');
  if (!membership) return forbidden();

  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.email !== 'string' ||
    typeof body.role !== 'string'
  ) {
    return badRequest('Email et rôle sont requis.');
  }

  const email = body.email.trim().toLowerCase();
  if (!email) return badRequest("L'email ne peut pas être vide.");

  const role = body.role as BusinessRole;
  if (!['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'].includes(role)) {
    return badRequest('Rôle invalide.');
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 jours

  const invite = await prisma.businessInvite.create({
    data: {
      businessId: businessIdBigInt,
      email,
      role,
      token,
      status: BusinessInviteStatus.PENDING,
      expiresAt,
    },
  });

  // TODO: envoyer un email avec le lien d'invitation

  const allowed = getAllowedOrigins();
  const inviteLink =
    allowed.length > 0
      ? `${allowed[0]}/app/pro?join=1&token=${encodeURIComponent(invite.token)}`
      : undefined;

  return jsonNoStore(
    {
      id: invite.id.toString(),
      businessId: invite.businessId.toString(),
      email: invite.email,
      role: invite.role,
      status: invite.status,
      createdAt: invite.createdAt.toISOString(),
      expiresAt: invite.expiresAt ? invite.expiresAt.toISOString() : null,
      ...(inviteLink ? { inviteLink } : {}),
    },
    { status: 201 }
  );
}
