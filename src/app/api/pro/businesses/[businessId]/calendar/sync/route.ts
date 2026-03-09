import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated, jsonbNoContent } from '@/server/http/json';

// GET /api/pro/businesses/{businessId}/calendar/sync — get or check token
export const GET = withBusinessRoute(
  { minRole: 'MEMBER' },
  async (ctx) => {
    const existing = await prisma.calendarToken.findUnique({
      where: { userId_businessId: { userId: ctx.userId, businessId: ctx.businessId } },
      select: { token: true, revokedAt: true, createdAt: true },
    });

    if (!existing || existing.revokedAt) {
      return jsonb({ token: null }, ctx.requestId);
    }

    return jsonb({ token: existing.token, createdAt: existing.createdAt.toISOString() }, ctx.requestId);
  },
);

// POST /api/pro/businesses/{businessId}/calendar/sync — generate token
export const POST = withBusinessRoute(
  { minRole: 'MEMBER' },
  async (ctx) => {
    // Upsert: create new or revive revoked token
    const token = await prisma.calendarToken.upsert({
      where: { userId_businessId: { userId: ctx.userId, businessId: ctx.businessId } },
      create: { userId: ctx.userId, businessId: ctx.businessId },
      update: { revokedAt: null, token: crypto.randomUUID() },
      select: { token: true, createdAt: true },
    });

    return jsonbCreated({ token: token.token, createdAt: token.createdAt.toISOString() }, ctx.requestId);
  },
);

// DELETE /api/pro/businesses/{businessId}/calendar/sync — revoke token
export const DELETE = withBusinessRoute(
  { minRole: 'MEMBER' },
  async (ctx) => {
    await prisma.calendarToken.updateMany({
      where: { userId: ctx.userId, businessId: ctx.businessId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return jsonbNoContent(ctx.requestId);
  },
);
