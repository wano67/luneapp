import { prisma } from '@/server/db/client';
import type { BusinessRole, BusinessMembership } from '@/generated/prisma/client';

const ROLE_WEIGHT: Record<BusinessRole, number> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export async function requireBusinessRole(
  businessId: bigint,
  userId: bigint,
  minRole: BusinessRole
): Promise<BusinessMembership | null> {
  const membership = await prisma.businessMembership.findUnique({
    where: { businessId_userId: { businessId, userId } },
  });

  if (!membership) return null;

  const current = ROLE_WEIGHT[membership.role];
  const required = ROLE_WEIGHT[minRole];

  return current >= required ? membership : null;
}
