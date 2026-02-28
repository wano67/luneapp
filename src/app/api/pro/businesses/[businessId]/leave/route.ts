import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';

// POST /api/pro/businesses/{businessId}/leave
export const POST = withBusinessRoute(
  {
    minRole: 'VIEWER',
    rateLimit: { key: (ctx) => `pro:businesses:leave:${ctx.businessId}:${ctx.userId}`, limit: 60, windowMs: 60 * 60 * 1000 },
  },
  async (ctx) => {
    if (ctx.membership.role === 'OWNER') {
      return badRequest('Un OWNER doit supprimer le business.');
    }

    const business = await prisma.business.findUnique({ where: { id: ctx.businessId } });
    if (!business) return notFound('Entreprise introuvable.');

    const deleted = await prisma.businessMembership.deleteMany({
      where: { businessId: ctx.businessId, userId: ctx.userId },
    });

    if (deleted.count === 0) {
      return notFound('Membership introuvable.');
    }

    return jsonb({ left: true }, ctx.requestId);
  }
);
