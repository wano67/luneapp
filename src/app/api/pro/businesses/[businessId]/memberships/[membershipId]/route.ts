import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest, notFound, withIdNoStore } from '@/server/http/apiUtils';
import { parseIdOpt } from '@/server/http/parsers';

// PATCH /api/pro/businesses/{businessId}/memberships/{membershipId}
export const PATCH = withBusinessRoute<{ businessId: string; membershipId: string }>(
  { minRole: 'ADMIN' },
  async (ctx, request, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const membershipIdBigInt = parseIdOpt(params.membershipId);
    if (!membershipIdBigInt) return withIdNoStore(badRequest('membershipId invalide.'), requestId);

    const membership = await prisma.businessMembership.findFirst({
      where: { id: membershipIdBigInt, businessId: businessIdBigInt },
      include: { user: { select: { id: true, email: true, name: true } }, organizationUnit: true },
    });
    if (!membership) return withIdNoStore(notFound('Membre introuvable.'), requestId);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return withIdNoStore(badRequest('Payload invalide.'), requestId);
    }

    if (!('organizationUnitId' in body)) {
      return withIdNoStore(badRequest('organizationUnitId requis.'), requestId);
    }

    const raw = (body as { organizationUnitId?: unknown }).organizationUnitId;
    let organizationUnitId: bigint | null = null;
    if (raw === null || raw === undefined || raw === '') {
      organizationUnitId = null;
    } else if (typeof raw === 'string' && /^\d+$/.test(raw)) {
      organizationUnitId = BigInt(raw);
      const unit = await prisma.organizationUnit.findFirst({
        where: { id: organizationUnitId, businessId: businessIdBigInt },
        select: { id: true },
      });
      if (!unit) return withIdNoStore(badRequest('organizationUnitId invalide.'), requestId);
    } else {
      return withIdNoStore(badRequest('organizationUnitId invalide.'), requestId);
    }

    const updated = await prisma.businessMembership.update({
      where: { id: membershipIdBigInt },
      data: { organizationUnitId },
      include: { user: { select: { id: true, email: true, name: true } }, organizationUnit: true },
    });

    return jsonb({
      item: {
        membershipId: updated.id.toString(),
        userId: updated.userId.toString(),
        email: updated.user?.email ?? null,
        name: updated.user?.name ?? null,
        role: updated.role,
        organizationUnit: updated.organizationUnit
          ? { id: updated.organizationUnit.id.toString(), name: updated.organizationUnit.name }
          : null,
      },
    }, requestId);
  }
);
