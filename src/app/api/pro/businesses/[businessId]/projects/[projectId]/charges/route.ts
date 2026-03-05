import { prisma } from '@/server/db/client';
import { FinanceType } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { notFound } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';

// GET /api/pro/businesses/{businessId}/projects/{projectId}/charges
export const GET = withBusinessRoute<{ businessId: string; projectId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _req, params) => {
    const projectId = parseId(params.projectId);

    const project = await prisma.project.findFirst({
      where: { id: projectId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!project) return notFound('Projet introuvable.');

    // 1) Direct charges (Finance EXPENSE linked to this project)
    const charges = await prisma.finance.findMany({
      where: {
        businessId: ctx.businessId,
        projectId,
        type: FinanceType.EXPENSE,
        deletedAt: null,
      },
      orderBy: { date: 'desc' },
      select: {
        id: true,
        type: true,
        amountCents: true,
        category: true,
        vendor: true,
        method: true,
        date: true,
        note: true,
      },
    });

    // 2) Project members with employee profiles
    const projectMembers = await prisma.projectMember.findMany({
      where: { projectId },
      include: {
        membership: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            employeeProfile: { select: { jobTitle: true, hourlyCostCents: true } },
          },
        },
      },
    });

    // 3) Sum estimatedMinutes per assignee
    const taskMinutes = await prisma.task.groupBy({
      by: ['assigneeUserId'],
      where: { projectId, businessId: ctx.businessId, assigneeUserId: { not: null } },
      _sum: { estimatedMinutes: true },
    });
    const minutesByUserId = new Map<bigint, number>();
    for (const row of taskMinutes) {
      if (row.assigneeUserId) {
        minutesByUserId.set(row.assigneeUserId, row._sum.estimatedMinutes ?? 0);
      }
    }

    // 4) Compute labor costs
    let totalLaborCostCents = 0n;
    const laborCosts = projectMembers.map((pm) => {
      const user = pm.membership.user;
      const profile = pm.membership.employeeProfile;
      const hourlyCostCents = profile?.hourlyCostCents ?? null;
      const totalMinutes = minutesByUserId.get(user.id) ?? 0;
      let laborCost = 0n;
      if (hourlyCostCents && totalMinutes > 0) {
        laborCost = (hourlyCostCents * BigInt(totalMinutes)) / 60n;
      }
      totalLaborCostCents += laborCost;
      return {
        membershipId: pm.membershipId,
        userName: user.name ?? user.email,
        jobTitle: profile?.jobTitle ?? null,
        hourlyCostCents,
        totalEstimatedMinutes: totalMinutes,
        totalLaborCostCents: laborCost,
      };
    });

    // 5) Totals
    const totalChargesCents = charges.reduce((sum, c) => {
      const amt = c.amountCents < 0n ? -c.amountCents : c.amountCents;
      return sum + amt;
    }, 0n);

    return jsonb({
      charges,
      laborCosts,
      totals: {
        totalChargesCents,
        totalLaborCostCents,
        grandTotalCents: totalChargesCents + totalLaborCostCents,
      },
    }, ctx.requestId);
  },
);
