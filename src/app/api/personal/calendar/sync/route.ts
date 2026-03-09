import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated, jsonbNoContent } from '@/server/http/json';

// GET /api/personal/calendar/sync — get or check token
export const GET = withPersonalRoute(async (ctx) => {
  const existing = await prisma.personalCalendarToken.findUnique({
    where: { userId: ctx.userId },
    select: { token: true, revokedAt: true, createdAt: true },
  });

  if (!existing || existing.revokedAt) {
    return jsonb({ token: null }, ctx.requestId);
  }

  return jsonb({ token: existing.token, createdAt: existing.createdAt.toISOString() }, ctx.requestId);
});

// POST /api/personal/calendar/sync — generate token
export const POST = withPersonalRoute(async (ctx) => {
  const token = await prisma.personalCalendarToken.upsert({
    where: { userId: ctx.userId },
    create: { userId: ctx.userId },
    update: { revokedAt: null, token: crypto.randomUUID() },
    select: { token: true, createdAt: true },
  });

  return jsonbCreated({ token: token.token, createdAt: token.createdAt.toISOString() }, ctx.requestId);
});

// DELETE /api/personal/calendar/sync — revoke token
export const DELETE = withPersonalRoute(async (ctx) => {
  await prisma.personalCalendarToken.updateMany({
    where: { userId: ctx.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return jsonbNoContent(ctx.requestId);
});
