import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';

// GET /api/pro/businesses/{businessId}/members
export const GET = withBusinessRoute({ minRole: 'ADMIN' }, async (ctx) => {
  const { requestId, businessId: businessIdBigInt } = ctx;

  const members = await prisma.businessMembership.findMany({
    where: { businessId: businessIdBigInt },
    include: {
      user: { select: { id: true, email: true, name: true } },
      organizationUnit: { select: { id: true, name: true } },
      employeeProfile: true,
      permissions: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  return jsonb({
    items: members.map((m) => ({
      membershipId: m.id.toString(),
      userId: m.userId.toString(),
      email: m.user?.email ?? '',
      name: m.user?.name ?? null,
      role: m.role,
      createdAt: m.createdAt.toISOString(),
      organizationUnit: m.organizationUnit
        ? { id: m.organizationUnit.id.toString(), name: m.organizationUnit.name }
        : null,
      employeeProfile: m.employeeProfile
        ? {
            id: m.employeeProfile.id.toString(),
            jobTitle: m.employeeProfile.jobTitle,
            contractType: m.employeeProfile.contractType,
            startDate: m.employeeProfile.startDate ? m.employeeProfile.startDate.toISOString() : null,
            endDate: m.employeeProfile.endDate ? m.employeeProfile.endDate.toISOString() : null,
            weeklyHours: m.employeeProfile.weeklyHours,
            hourlyCostCents: m.employeeProfile.hourlyCostCents
              ? m.employeeProfile.hourlyCostCents.toString()
              : null,
            status: m.employeeProfile.status,
            notes: m.employeeProfile.notes,
            createdAt: m.employeeProfile.createdAt.toISOString(),
            updatedAt: m.employeeProfile.updatedAt.toISOString(),
          }
        : null,
      permissions: m.permissions.map((p) => p.permission),
    })),
  }, requestId);
});
