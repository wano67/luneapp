import { prisma } from '@/server/db/client';
import { Prisma, ProjectStatus } from '@/generated/prisma';

export type ProjectScope = 'ACTIVE' | 'PLANNED' | 'INACTIVE' | 'ALL';

// Terminal or paused statuses that should never count as active/planned.
const INACTIVE_STATUSES: ProjectStatus[] = [
  ProjectStatus.COMPLETED,
  ProjectStatus.CANCELLED,
  ProjectStatus.ON_HOLD,
];

function buildScopeWhere(scope: ProjectScope, includeArchived: boolean): Prisma.ProjectWhereInput {
  switch (scope) {
    case 'ACTIVE':
      return { status: ProjectStatus.ACTIVE, archivedAt: null };
    case 'PLANNED':
      return { status: ProjectStatus.PLANNED, archivedAt: null };
    case 'INACTIVE':
      return {
        OR: [{ status: { in: INACTIVE_STATUSES } }, { archivedAt: { not: null } }],
      };
    case 'ALL':
    default:
      return includeArchived ? {} : { archivedAt: null };
  }
}

export function buildProjectScopeWhere(args: {
  scope: ProjectScope;
  includeArchived?: boolean;
}): Prisma.ProjectWhereInput {
  const includeArchived = args.includeArchived ?? (args.scope === 'ALL');
  return buildScopeWhere(args.scope, includeArchived);
}

export function buildProjectWhere(args: {
  businessId: string;
  scope: ProjectScope;
  includeArchived?: boolean;
}): Prisma.ProjectWhereInput {
  const businessId = BigInt(args.businessId);
  const includeArchived = args.includeArchived ?? (args.scope === 'ALL');
  return {
    businessId,
    ...buildScopeWhere(args.scope, includeArchived),
  };
}

export function mapProjectStatusToScope(status: ProjectStatus): ProjectScope {
  if (status === ProjectStatus.ACTIVE) return 'ACTIVE';
  if (status === ProjectStatus.PLANNED) return 'PLANNED';
  return 'INACTIVE';
}

export async function getProjectCounts(args: { businessId: string }): Promise<{
  active: number;
  planned: number;
  inactive: number;
  archived: number;
  total: number;
}> {
  const businessId = BigInt(args.businessId);

  const [active, planned, inactive, archived, total] = await Promise.all([
    prisma.project.count({
      where: buildProjectWhere({ businessId: args.businessId, scope: 'ACTIVE' }),
    }),
    prisma.project.count({
      where: buildProjectWhere({ businessId: args.businessId, scope: 'PLANNED' }),
    }),
    prisma.project.count({
      where: buildProjectWhere({ businessId: args.businessId, scope: 'INACTIVE' }),
    }),
    prisma.project.count({
      where: { businessId, archivedAt: { not: null } },
    }),
    prisma.project.count({
      where: buildProjectWhere({ businessId: args.businessId, scope: 'ALL', includeArchived: true }),
    }),
  ]);

  return { active, planned, inactive, archived, total };
}
