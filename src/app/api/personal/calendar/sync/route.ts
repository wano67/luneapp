import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated, jsonbNoContent } from '@/server/http/json';
import { hashToken, generateToken } from '@/server/security/tokenHash';

// GET /api/personal/calendar/sync — check if token exists
export const GET = withPersonalRoute(async (ctx) => {
  const existing = await prisma.personalCalendarToken.findUnique({
    where: { userId: ctx.userId },
    select: { revokedAt: true, createdAt: true },
  });

  if (!existing || existing.revokedAt) {
    return jsonb({ hasToken: false }, ctx.requestId);
  }

  return jsonb({ hasToken: true, createdAt: existing.createdAt.toISOString() }, ctx.requestId);
});

// POST /api/personal/calendar/sync — generate token
export const POST = withPersonalRoute(async (ctx) => {
  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);

  await prisma.personalCalendarToken.upsert({
    where: { userId: ctx.userId },
    create: { userId: ctx.userId, token: tokenHash },
    update: { revokedAt: null, token: tokenHash },
  });

  return jsonbCreated({ token: rawToken, createdAt: new Date().toISOString() }, ctx.requestId);
});

// DELETE /api/personal/calendar/sync — revoke token
export const DELETE = withPersonalRoute(async (ctx) => {
  await prisma.personalCalendarToken.updateMany({
    where: { userId: ctx.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return jsonbNoContent(ctx.requestId);
});
