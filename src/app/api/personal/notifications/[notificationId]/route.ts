import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { parseIdOpt } from '@/server/http/parsers';
import { serializeNotification } from '@/server/http/serializeNotification';

// PATCH /api/personal/notifications/{notificationId}
export const PATCH = withPersonalRoute(async (ctx, req) => {
  const { requestId, userId } = ctx;

  const notifId = parseIdOpt(req.nextUrl.pathname.split('/').at(-1));
  if (!notifId) return badRequest('notificationId invalide.');

  const body = await req.json() as Record<string, unknown>;
  if (typeof body.isRead !== 'boolean') return badRequest('isRead requis (boolean).');

  const existing = await prisma.notification.findFirst({
    where: { id: notifId, userId },
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
});
