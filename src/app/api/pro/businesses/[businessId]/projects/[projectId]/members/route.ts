import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, notFound, withIdNoStore } from '@/server/http/apiUtils';

function parseId(param: string | undefined | null): bigint | null {
  if (!param || !/^\d+$/.test(param)) return null;
  try { return BigInt(param); } catch { return null; }
}

// GET /api/pro/businesses/{businessId}/projects/{projectId}/members
export const GET = withBusinessRoute<{ businessId: string; projectId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _request, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const projectIdBigInt = parseId(params.projectId);
    if (!projectIdBigInt) return withIdNoStore(badRequest('projectId invalide.'), requestId);

    const project = await prisma.project.findFirst({
      where: { id: projectIdBigInt, businessId: businessIdBigInt },
      select: { id: true },
    });
    if (!project) return withIdNoStore(notFound('Projet introuvable.'), requestId);

    const members = await prisma.projectMember.findMany({
      where: { projectId: projectIdBigInt },
      include: {
        membership: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            organizationUnit: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const adminMembers = await prisma.businessMembership.findMany({
      where: {
        businessId: businessIdBigInt,
        role: { in: ['OWNER', 'ADMIN'] },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        organizationUnit: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const items = members.map((m) => ({
      membershipId: m.membershipId.toString(),
      user: {
        id: m.membership.userId.toString(),
        name: m.membership.user?.name ?? null,
        email: m.membership.user?.email ?? null,
      },
      role: m.membership.role,
      organizationUnit: m.membership.organizationUnit
        ? { id: m.membership.organizationUnit.id.toString(), name: m.membership.organizationUnit.name }
        : null,
      createdAt: m.createdAt.toISOString(),
      implicit: m.membership.role === 'OWNER' || m.membership.role === 'ADMIN',
    }));

    const existingIds = new Set(items.map((item) => item.membershipId));
    for (const member of adminMembers) {
      const membershipId = member.id.toString();
      if (existingIds.has(membershipId)) continue;
      items.push({
        membershipId,
        user: {
          id: member.userId.toString(),
          name: member.user?.name ?? null,
          email: member.user?.email ?? null,
        },
        role: member.role,
        organizationUnit: member.organizationUnit
          ? { id: member.organizationUnit.id.toString(), name: member.organizationUnit.name }
          : null,
        createdAt: member.createdAt.toISOString(),
        implicit: true,
      });
    }

    return jsonb({ items }, requestId);
  }
);

// POST /api/pro/businesses/{businessId}/projects/{projectId}/members
export const POST = withBusinessRoute<{ businessId: string; projectId: string }>(
  { minRole: 'ADMIN' },
  async (ctx, request, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const projectIdBigInt = parseId(params.projectId);
    if (!projectIdBigInt) return withIdNoStore(badRequest('projectId invalide.'), requestId);

    const project = await prisma.project.findFirst({
      where: { id: projectIdBigInt, businessId: businessIdBigInt },
      select: { id: true },
    });
    if (!project) return withIdNoStore(notFound('Projet introuvable.'), requestId);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return withIdNoStore(badRequest('Payload invalide.'), requestId);
    }

    const membershipIdRaw = (body as { membershipId?: unknown }).membershipId;
    if (typeof membershipIdRaw !== 'string' || !/^\d+$/.test(membershipIdRaw)) {
      return withIdNoStore(badRequest('membershipId invalide.'), requestId);
    }
    const membershipId = BigInt(membershipIdRaw);

    const targetMembership = await prisma.businessMembership.findFirst({
      where: { id: membershipId, businessId: businessIdBigInt },
      include: {
        user: { select: { id: true, name: true, email: true } },
        organizationUnit: { select: { id: true, name: true } },
      },
    });
    if (!targetMembership) {
      return withIdNoStore(badRequest('membershipId invalide pour ce business.'), requestId);
    }

    const created = await prisma.projectMember.upsert({
      where: {
        projectId_membershipId: {
          projectId: projectIdBigInt,
          membershipId,
        },
      },
      create: {
        projectId: projectIdBigInt,
        membershipId,
      },
      update: {},
      include: {
        membership: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            organizationUnit: { select: { id: true, name: true } },
          },
        },
      },
    });

    return jsonbCreated({
      item: {
        membershipId: created.membershipId.toString(),
        user: {
          id: created.membership.userId.toString(),
          name: created.membership.user?.name ?? null,
          email: created.membership.user?.email ?? null,
        },
        role: created.membership.role,
        organizationUnit: created.membership.organizationUnit
          ? { id: created.membership.organizationUnit.id.toString(), name: created.membership.organizationUnit.name }
          : null,
        createdAt: created.createdAt.toISOString(),
      },
    }, requestId);
  }
);
