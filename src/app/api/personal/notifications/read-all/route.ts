import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonbNoContent } from '@/server/http/json';

// POST /api/personal/notifications/read-all
export const POST = withPersonalRoute(async (ctx) => {
  const { requestId, userId } = ctx;

  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });

  return jsonbNoContent(requestId);
});
