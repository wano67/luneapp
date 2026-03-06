import { prisma } from '@/server/db/client';
import { BusinessInviteStatus } from '@/generated/prisma';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';

export const GET = withPersonalRoute(async (ctx) => {
  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { email: true },
  });
  if (!user) return jsonb({ items: [] }, ctx.requestId);

  const invites = await prisma.businessInvite.findMany({
    where: {
      email: { equals: user.email, mode: 'insensitive' },
      status: BusinessInviteStatus.PENDING,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: { business: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  // Filter out businesses user is already a member of
  const memberBusinessIds = new Set(
    (
      await prisma.businessMembership.findMany({
        where: { userId: ctx.userId },
        select: { businessId: true },
      })
    ).map((m) => m.businessId),
  );

  const items = invites
    .filter((inv) => !memberBusinessIds.has(inv.businessId))
    .map((inv) => ({
      id: inv.id.toString(),
      businessName: inv.business.name,
      businessId: inv.businessId.toString(),
      role: inv.role,
      token: inv.token,
      createdAt: inv.createdAt.toISOString(),
      expiresAt: inv.expiresAt?.toISOString() ?? null,
    }));

  return jsonb({ items }, ctx.requestId);
});
