import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { BusinessRole, BusinessInviteStatus } from '@/generated/prisma/client';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, getAllowedOrigins, jsonNoStore, withNoStore } from '@/server/security/csrf';
import crypto from 'crypto';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import {
  badRequest,
  forbidden,
  getRequestId,
  notFound,
  serverError,
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

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function withIdNoStore(res: NextResponse, requestId: string) {
  return withNoStore(withRequestId(res, requestId));
}

function hashToken(raw: string) {
  return crypto.createHash('sha256').update(raw).digest('base64url');
}

function buildBaseUrl(request: NextRequest) {
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost =
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || request.headers.get('host');
  if (forwardedHost) {
    const proto = forwardedProto || 'https';
    try {
      return new URL(`${proto}://${forwardedHost}`).origin;
    } catch {
      // fall through
    }
  }

  const allowed = getAllowedOrigins();
  if (allowed.length > 0) return allowed[0];

  try {
    return new URL(request.url).origin;
  } catch {
    return 'http://localhost:3000';
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
    return withIdNoStore(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) {
    return withIdNoStore(badRequest('businessId invalide.'), requestId);
  }

  const business = await prisma.business.findUnique({ where: { id: businessIdBigInt } });
  if (!business) return withIdNoStore(notFound('Entreprise introuvable.'), requestId);

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const invites = await prisma.businessInvite.findMany({
    where: { businessId: businessIdBigInt },
    orderBy: { createdAt: 'desc' },
  });

  const baseUrl = buildBaseUrl(request);
  const now = Date.now();
  const expiredIds: bigint[] = [];
  const items = invites.map((inv) => {
    const expired = inv.expiresAt ? inv.expiresAt.getTime() < now : false;
    const status =
      expired && inv.status === BusinessInviteStatus.PENDING ? BusinessInviteStatus.EXPIRED : inv.status;

    if (status === BusinessInviteStatus.EXPIRED && inv.status !== BusinessInviteStatus.EXPIRED) {
      expiredIds.push(inv.id);
    }

    const inviteLink =
      status === BusinessInviteStatus.PENDING
        ? `${baseUrl}/app/pro?join=1&token=${encodeURIComponent(inv.token)}`
        : undefined;

    return {
      id: inv.id.toString(),
      businessId: inv.businessId.toString(),
      email: inv.email,
      role: inv.role,
      status,
      createdAt: inv.createdAt.toISOString(),
      expiresAt: inv.expiresAt ? inv.expiresAt.toISOString() : null,
      ...(inviteLink ? { inviteLink, tokenPreview: inv.token.slice(-6) } : {}),
    };
  });

  if (expiredIds.length > 0) {
    await prisma.businessInvite.updateMany({
      where: { id: { in: expiredIds } },
      data: { status: BusinessInviteStatus.EXPIRED },
    });
  }

  return withIdNoStore(
    jsonNoStore({ items }),
    requestId
  );
}

// POST /api/pro/businesses/{businessId}/invites
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId } = await context.params;

  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

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
  if (limited) return withIdNoStore(limited, requestId);

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) {
    return withIdNoStore(badRequest('businessId invalide.'), requestId);
  }
  const business = await prisma.business.findUnique({ where: { id: businessIdBigInt } });
  if (!business) {
    return withIdNoStore(notFound('Entreprise introuvable.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const body = await request.json().catch(() => null);
  if (!body || typeof body.email !== 'string' || typeof body.role !== 'string') {
    return withIdNoStore(badRequest('Email et rôle sont requis.'), requestId);
  }

  const email = body.email.trim().toLowerCase();
  if (!email) return withIdNoStore(badRequest("L'email ne peut pas être vide."), requestId);

  const role = body.role as BusinessRole;
  if (!['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'].includes(role)) {
    return withIdNoStore(badRequest('Rôle invalide.'), requestId);
  }

  if (email.length > 254 || !isValidEmail(email)) {
    return withIdNoStore(badRequest('Email invalide.'), requestId);
  }

  // Refuse si l'utilisateur est déjà membre
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const existingMembership = await prisma.businessMembership.findUnique({
      where: {
        businessId_userId: {
          businessId: businessIdBigInt,
          userId: existingUser.id,
        },
      },
    });
    if (existingMembership) {
      return withIdNoStore(
        jsonNoStore({ error: 'Cet utilisateur est déjà membre de ce business.' }, { status: 409 }),
        requestId
      );
    }
  }

  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 jours
  const baseUrl = buildBaseUrl(request);

  const existingInvite = await prisma.businessInvite.findFirst({
    where: {
      businessId: businessIdBigInt,
      email,
      status: BusinessInviteStatus.PENDING,
    },
  });

  const now = new Date();
  if (existingInvite && existingInvite.expiresAt && existingInvite.expiresAt < now) {
    await prisma.businessInvite.update({
      where: { id: existingInvite.id },
      data: { status: BusinessInviteStatus.EXPIRED },
    });
  }

  let invite;
  try {
    if (existingInvite && existingInvite.status === BusinessInviteStatus.PENDING) {
      invite = await prisma.businessInvite.update({
        where: { id: existingInvite.id },
        data: {
          role,
          token: tokenHash,
          expiresAt,
          status: BusinessInviteStatus.PENDING,
        },
      });
    } else {
      invite = await prisma.businessInvite.create({
        data: {
          businessId: businessIdBigInt,
          email,
          role,
          token: tokenHash,
          status: BusinessInviteStatus.PENDING,
          expiresAt,
        },
      });
    }
  } catch (error) {
    console.error({ requestId, route: '/api/pro/businesses/[businessId]/invites', error });
    return withIdNoStore(serverError(), requestId);
  }

  // TODO: envoyer un email avec le lien d'invitation

  const inviteLink = `${baseUrl}/app/pro?join=1&token=${encodeURIComponent(rawToken)}`;

  return withIdNoStore(
    jsonNoStore(
      {
        id: invite.id.toString(),
        businessId: invite.businessId.toString(),
        email: invite.email,
        role: invite.role,
        status: invite.status,
        createdAt: invite.createdAt.toISOString(),
        expiresAt: invite.expiresAt ? invite.expiresAt.toISOString() : null,
        ...(inviteLink ? { inviteLink, tokenPreview: rawToken.slice(-6) } : { tokenPreview: rawToken.slice(-6) }),
      },
      { status: 201 }
    ),
    requestId
  );
}
