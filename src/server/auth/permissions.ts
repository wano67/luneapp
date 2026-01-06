import type {
  BusinessMemberPermission,
  BusinessMembership,
  BusinessPermission,
} from '@/generated/prisma';

const ADMIN_ROLES: Array<BusinessMembership['role']> = ['OWNER', 'ADMIN'];

export function hasPermission(
  membership: BusinessMembership & { permissions?: BusinessMemberPermission[] },
  permission: BusinessPermission
): boolean {
  if (ADMIN_ROLES.includes(membership.role)) return true;
  const perms = membership.permissions ?? [];
  return perms.some((p) => p.permission === permission);
}

export function isAdminRole(role: BusinessMembership['role']) {
  return ADMIN_ROLES.includes(role);
}
