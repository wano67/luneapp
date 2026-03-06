import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { serializeNotification } from '@/server/http/serializeNotification';

// GET /api/personal/notifications — aggregate cross-business
export const GET = withPersonalRoute(async (ctx, req) => {
  const { requestId, userId } = ctx;
  const url = req.nextUrl;
  const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
  const limitParam = parseInt(url.searchParams.get('limit') ?? '30', 10);
  const limit = Math.min(Math.max(1, limitParam), 100);
  const cursor = url.searchParams.get('cursor');

  const where = {
    userId,
    ...(unreadOnly ? { isRead: false } : {}),
    ...(cursor ? { id: { lt: BigInt(cursor) } } : {}),
  };

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.notification.count({
      where: { userId, isRead: false },
    }),
  ]);

  return jsonb({ items: items.map(serializeNotification), unreadCount }, requestId);
});
