import { prisma } from '@/server/db/client';
import { NotificationType } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { serializeNotification } from '@/server/http/serializeNotification';
import { parseCursorOpt } from '@/server/http/parsers';

// GET /api/pro/businesses/{businessId}/notifications
export const GET = withBusinessRoute(
  {
    minRole: 'VIEWER',
    rateLimit: { key: (ctx) => `pro:notifications:list:${ctx.businessId}:${ctx.userId}`, limit: 200, windowMs: 3_600_000 },
  },
  async (ctx, req) => {
    const { requestId, businessId, userId } = ctx;
    const url = req.nextUrl;
    const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
    const limitParam = parseInt(url.searchParams.get('limit') ?? '30', 10);
    const limit = Math.min(Math.max(1, limitParam), 100);
    const cursorId = parseCursorOpt(url.searchParams.get('cursor'));

    const typeParam = url.searchParams.get('type');
    const allTypes = Object.values(NotificationType) as string[];
    const typeFilter = typeParam
      ? typeParam.split(',').map((t) => t.trim()).filter((t) => allTypes.includes(t)) as NotificationType[]
      : null;

    const where = {
      userId,
      businessId,
      ...(unreadOnly ? { isRead: false } : {}),
      ...(typeFilter ? { type: { in: typeFilter } } : {}),
      ...(cursorId ? { id: { lt: cursorId } } : {}),
    };

    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.notification.count({
        where: { userId, businessId, isRead: false },
      }),
    ]);

    const nextCursor = items.length === limit ? String(items[items.length - 1].id) : null;

    return jsonb({ items: items.map(serializeNotification), unreadCount, nextCursor }, requestId);
  },
);
