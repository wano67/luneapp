import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { parseIdOpt } from '@/server/http/parsers';
import { serializeNotification } from '@/server/http/serializeNotification';

// PATCH /api/pro/businesses/{businessId}/notifications/{notificationId}
export const PATCH = withBusinessRoute<{ businessId: string; notificationId: string }>(
  {
    minRole: 'VIEWER',
    rateLimit: { key: (ctx) => `pro:notifications:update:${ctx.businessId}:${ctx.userId}`, limit: 300, windowMs: 3_600_000 },
  },
  async (ctx, req, params) => {
    const { requestId, businessId, userId } = ctx;

    const notifId = parseIdOpt(params?.notificationId);
    if (!notifId) return badRequest('notificationId invalide.');

    const body = await req.json() as Record<string, unknown>;
    if (typeof body.isRead !== 'boolean') return badRequest('isRead requis (boolean).');

    const existing = await prisma.notification.findFirst({
      where: { id: notifId, userId, businessId },
    });
    if (!existing) return notFound('Notification introuvable.');

    const updated = await prisma.notification.update({
      where: { id: notifId },
      data: {
        isRead: body.isRead,
        readAt: body.isRead ? new Date() : null,
      },
    });

    return jsonb({ item: serializeNotification(updated) }, requestId);
  },
);
