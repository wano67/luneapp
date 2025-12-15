import { NextRequest } from 'next/server';
import { prisma } from '@/server/db/client';
import { BusinessRole, BusinessInviteStatus } from '@/generated/prisma/client';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, getAllowedOrigins, jsonNoStore } from '@/server/security/csrf';
import crypto from 'crypto';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import {
  badRequest,
  forbidden,
  getRequestId,
  unauthorized,
  withRequestId,
} from '@/server/http/apiUtils';

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

// GET /api/pro/businesses/{businessId}/invites
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withRequestId(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) {
    return withRequestId(badRequest('businessId invalide.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withRequestId(forbidden(), requestId);

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
  const requestId = getRequestId(request);
  const { businessId } = await context.params;

  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  let userIdForRate: string | null = null;
  try {
    const auth = await requireAuthPro(request);
    userIdForRate = auth.userId;
  } catch {
    userIdForRate = null;
  }
  const limited = rateLimit(request, {
    key: userIdForRate
      ? `pro:invites:create:${businessId}:${userIdForRate.toString()}`
      : makeIpKey(request, `pro:invites:create:${businessId}`),
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

  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) {
    return withRequestId(badRequest('businessId invalide.'), requestId);
  }
  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withRequestId(forbidden(), requestId);

  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.email !== 'string' ||
    typeof body.role !== 'string'
  ) {
    return withRequestId(badRequest('Email et rôle sont requis.'), requestId);
  }

  const email = body.email.trim().toLowerCase();
  if (!email) return withRequestId(badRequest("L'email ne peut pas être vide."), requestId);

  const role = body.role as BusinessRole;
  if (!['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'].includes(role)) {
    return withRequestId(badRequest('Rôle invalide.'), requestId);
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
