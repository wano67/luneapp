import { NextRequest } from 'next/server';
import { prisma } from '@/server/db/client';
import { BusinessRole, BusinessInviteStatus } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, notFound, readJson, serverError } from '@/server/http/apiUtils';
import { getAllowedOrigins } from '@/server/security/csrf';
import crypto from 'crypto';

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashToken(raw: string) {
  return crypto.createHash('sha256').update(raw).digest('base64url');
}

function buildBaseUrl(request: NextRequest) {
  const envBase = process.env.BASE_URL?.trim();
  if (envBase) {
    try {
      return new URL(envBase).origin;
    } catch {
      // ignore and fallback
    }
  }
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
export const GET = withBusinessRoute(
  { minRole: 'ADMIN' },
  async (ctx, req) => {
    const business = await prisma.business.findUnique({ where: { id: ctx.businessId } });
    if (!business) return notFound('Entreprise introuvable.');

    const invites = await prisma.businessInvite.findMany({
      where: { businessId: ctx.businessId },
      orderBy: { createdAt: 'desc' },
    });

    const baseUrl = buildBaseUrl(req);
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
        status === BusinessInviteStatus.PENDING || status === BusinessInviteStatus.ACCEPTED
          ? `${baseUrl}/app/invites/accept?token=${encodeURIComponent(inv.token)}`
          : undefined;

      return {
        id: inv.id,
        businessId: inv.businessId,
        email: inv.email,
        role: inv.role,
        status,
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt,
        ...(inviteLink ? { inviteLink, tokenPreview: inv.token.slice(-6) } : {}),
      };
    });

    if (expiredIds.length > 0) {
      await prisma.businessInvite.updateMany({
        where: { id: { in: expiredIds } },
        data: { status: BusinessInviteStatus.EXPIRED },
      });
    }

    return jsonb({ items }, ctx.requestId);
  }
);

// POST /api/pro/businesses/{businessId}/invites
export const POST = withBusinessRoute(
  {
    minRole: 'ADMIN',
    rateLimit: { key: (ctx) => `pro:invites:create:${ctx.businessId}:${ctx.userId}`, limit: 60, windowMs: 60 * 60 * 1000 },
  },
  async (ctx, req) => {
    const business = await prisma.business.findUnique({ where: { id: ctx.businessId } });
    if (!business) return notFound('Entreprise introuvable.');

    const body = await readJson(req);
    if (!body || typeof (body as Record<string, unknown>).email !== 'string' || typeof (body as Record<string, unknown>).role !== 'string') {
      return badRequest('Email et rôle sont requis.');
    }

    const b = body as Record<string, unknown>;
    const email = (b.email as string).trim().toLowerCase();
    if (!email) return badRequest("L'email ne peut pas être vide.");

    const role = b.role as BusinessRole;
    if (!['ADMIN', 'MEMBER', 'VIEWER'].includes(role)) {
      return badRequest('Rôle invalide.');
    }

    if (email.length > 254 || !isValidEmail(email)) {
      return badRequest('Email invalide.');
    }

    // Refuse si l'utilisateur est déjà membre
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMembership = await prisma.businessMembership.findUnique({
        where: {
          businessId_userId: {
            businessId: ctx.businessId,
            userId: existingUser.id,
          },
        },
      });
      if (existingMembership) {
        return jsonb({ error: 'Cet utilisateur est déjà membre de ce business.' }, ctx.requestId, { status: 409 });
      }
    }

    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 jours
    const baseUrl = buildBaseUrl(req);

    const existingInvite = await prisma.businessInvite.findFirst({
      where: {
        businessId: ctx.businessId,
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
            businessId: ctx.businessId,
            email,
            role,
            token: tokenHash,
            status: BusinessInviteStatus.PENDING,
            expiresAt,
          },
        });
      }
    } catch {
      return serverError();
    }

    // TODO: envoyer un email avec le lien d'invitation

    const inviteLink = `${baseUrl}/app/invites/accept?token=${encodeURIComponent(tokenHash)}`;

    return jsonbCreated(
      {
        item: {
          ...invite,
          inviteLink,
          tokenPreview: rawToken.slice(-6),
        },
      },
      ctx.requestId
    );
  }
);
