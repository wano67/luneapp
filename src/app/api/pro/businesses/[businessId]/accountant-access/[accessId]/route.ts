import { prisma } from '@/server/db/client';
import { AccountantAccessLevel } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { parseIdOpt } from '@/server/http/parsers';

const VALID_LEVELS = Object.values(AccountantAccessLevel);

const include = {
  accountant: { select: { firstName: true, lastName: true, email: true } },
} as const;

// PATCH /api/pro/businesses/{businessId}/accountant-access/{accessId}
export const PATCH = withBusinessRoute<{ businessId: string; accessId: string }>(
  { minRole: 'OWNER' },
  async (ctx, req, params) => {
    const aid = parseIdOpt(params?.accessId);
    if (!aid) return badRequest('accessId invalide.');

    const existing = await prisma.accountantAccess.findFirst({
      where: { id: aid, businessId: ctx.businessId },
    });
    if (!existing) return notFound('Accès introuvable.');

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Payload invalide.');
    const b = body as Record<string, unknown>;

    const data: Record<string, unknown> = {};
    if ('accessLevel' in b && VALID_LEVELS.includes(b.accessLevel as AccountantAccessLevel)) {
      data.accessLevel = b.accessLevel;
    }
    if ('revoke' in b && b.revoke === true) {
      data.revokedAt = new Date();
    }
    if ('expiresAt' in b) {
      data.expiresAt = typeof b.expiresAt === 'string' ? new Date(b.expiresAt) : null;
    }

    if (Object.keys(data).length === 0) return badRequest('Aucune modification.');

    const updated = await prisma.accountantAccess.update({
      where: { id: aid },
      data,
      include,
    });

    return jsonb({
      item: {
        id: updated.id.toString(),
        accountantUserId: updated.accountantUserId.toString(),
        token: updated.token,
        accessLevel: updated.accessLevel,
        accountantName: updated.accountant ? `${updated.accountant.firstName ?? ''} ${updated.accountant.lastName ?? ''}`.trim() || updated.accountant.email : null,
        accountantEmail: updated.accountant?.email ?? null,
        expiresAt: updated.expiresAt?.toISOString() ?? null,
        revokedAt: updated.revokedAt?.toISOString() ?? null,
        lastAccessAt: updated.lastAccessAt?.toISOString() ?? null,
        portalUrl: `/accountant/${updated.token}`,
        createdAt: updated.createdAt.toISOString(),
      },
    }, ctx.requestId);
  },
);

// DELETE /api/pro/businesses/{businessId}/accountant-access/{accessId}
export const DELETE = withBusinessRoute<{ businessId: string; accessId: string }>(
  { minRole: 'OWNER' },
  async (ctx, _req, params) => {
    const aid = parseIdOpt(params?.accessId);
    if (!aid) return badRequest('accessId invalide.');

    const existing = await prisma.accountantAccess.findFirst({
      where: { id: aid, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!existing) return notFound('Accès introuvable.');

    await prisma.accountantAccess.delete({ where: { id: aid } });
    return jsonbNoContent(ctx.requestId);
  },
);
