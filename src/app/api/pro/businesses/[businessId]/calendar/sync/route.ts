import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated, jsonbNoContent } from '@/server/http/json';
import { hashToken, generateToken } from '@/server/security/tokenHash';

// GET /api/pro/businesses/{businessId}/calendar/sync — check if token exists
export const GET = withBusinessRoute(
  { minRole: 'MEMBER' },
  async (ctx) => {
    const existing = await prisma.calendarToken.findUnique({
      where: { userId_businessId: { userId: ctx.userId, businessId: ctx.businessId } },
      select: { revokedAt: true, createdAt: true },
    });

    if (!existing || existing.revokedAt) {
      return jsonb({ hasToken: false }, ctx.requestId);
    }

    return jsonb({ hasToken: true, createdAt: existing.createdAt.toISOString() }, ctx.requestId);
  },
);

// POST /api/pro/businesses/{businessId}/calendar/sync — generate token
export const POST = withBusinessRoute(
  { minRole: 'MEMBER' },
  async (ctx) => {
    const rawToken = generateToken();
    const tokenHash = hashToken(rawToken);

    await prisma.calendarToken.upsert({
      where: { userId_businessId: { userId: ctx.userId, businessId: ctx.businessId } },
      create: { userId: ctx.userId, businessId: ctx.businessId, token: tokenHash },
      update: { revokedAt: null, token: tokenHash },
    });

    return jsonbCreated({ token: rawToken, createdAt: new Date().toISOString() }, ctx.requestId);
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
