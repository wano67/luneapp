import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonbNoContent } from '@/server/http/json';

// POST /api/pro/businesses/{businessId}/notifications/read-all
export const POST = withBusinessRoute(
  {
    minRole: 'VIEWER',
    rateLimit: { key: (ctx) => `pro:notifications:readAll:${ctx.businessId}:${ctx.userId}`, limit: 30, windowMs: 3_600_000 },
  },
  async (ctx) => {
    const { requestId, businessId, userId } = ctx;

    await prisma.notification.updateMany({
      where: { userId, businessId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    return jsonbNoContent(requestId);
  },
);
