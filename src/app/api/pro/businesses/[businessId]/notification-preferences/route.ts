import { prisma } from '@/server/db/client';
import { NotificationType } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest, withIdNoStore } from '@/server/http/apiUtils';

const ALL_TYPES = Object.values(NotificationType);

// GET /api/pro/businesses/{businessId}/notification-preferences
export const GET = withBusinessRoute({ minRole: 'VIEWER' }, async (ctx) => {
  const rows = await prisma.notificationPreference.findMany({
    where: { userId: ctx.userId, businessId: ctx.businessId },
    select: { type: true, enabled: true },
  });

  const prefs: Record<string, boolean> = {};
  for (const t of ALL_TYPES) prefs[t] = true; // default enabled
  for (const row of rows) prefs[row.type] = row.enabled;

  return jsonb({ preferences: prefs }, ctx.requestId);
});

// PATCH /api/pro/businesses/{businessId}/notification-preferences
export const PATCH = withBusinessRoute(
  {
    minRole: 'VIEWER',
    rateLimit: {
      key: (ctx) => `notif-prefs:${ctx.businessId}:${ctx.userId}`,
      limit: 60,
      windowMs: 10 * 60 * 1000,
    },
  },
  async (ctx, req) => {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return withIdNoStore(badRequest('Payload invalide.'), ctx.requestId);
    }

    const { type, enabled } = body as { type?: string; enabled?: boolean };

    if (!type || !ALL_TYPES.includes(type as NotificationType)) {
      return withIdNoStore(badRequest('Type de notification invalide.'), ctx.requestId);
    }
    if (typeof enabled !== 'boolean') {
      return withIdNoStore(badRequest('enabled doit être un booléen.'), ctx.requestId);
    }

    await prisma.notificationPreference.upsert({
      where: {
        userId_businessId_type: {
          userId: ctx.userId,
          businessId: ctx.businessId,
          type: type as NotificationType,
        },
      },
      update: { enabled },
      create: {
        userId: ctx.userId,
        businessId: ctx.businessId,
        type: type as NotificationType,
        enabled,
      },
    });

    // Return full preferences map
    const rows = await prisma.notificationPreference.findMany({
      where: { userId: ctx.userId, businessId: ctx.businessId },
      select: { type: true, enabled: true },
    });

    const prefs: Record<string, boolean> = {};
    for (const t of ALL_TYPES) prefs[t] = true;
    for (const row of rows) prefs[row.type] = row.enabled;

    return jsonb({ preferences: prefs }, ctx.requestId);
  },
);
