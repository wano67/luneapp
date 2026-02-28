import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';

export const GET = withPersonalRoute(async (ctx) => {
  const items = await prisma.personalCategory.findMany({
    where: { userId: ctx.userId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  return jsonb({ items }, ctx.requestId);
});
