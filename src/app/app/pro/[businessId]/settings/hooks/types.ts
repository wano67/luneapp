// Shared types and pure helpers for settings/team page and hooks

export type BusinessRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
export type BusinessPermission = 'TEAM_EDIT' | 'FINANCE_EDIT';
export type BusinessInviteStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';

export type EmployeeProfile = {
  id?: string;
  jobTitle: string | null;
  contractType: string | null;
  startDate: string | null;
  endDate: string | null;
  weeklyHours: number | null;
  hourlyCostCents: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  notes: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type Member = {
  userId: string;
  email: string;
  role: BusinessRole;
  createdAt: string;
  employeeProfile: EmployeeProfile | null;
  permissions: BusinessPermission[];
};

export type MembersResponse = { items: Member[] };
export type MeResponse = { user: { id: string; email: string } };

export type InviteItem = {
  id: string;
  email: string;
  role: BusinessRole;
  status: BusinessInviteStatus;
  createdAt: string;
  expiresAt: string | null;
  inviteLink?: string;
  tokenPreview?: string;
};

export type InvitesResponse = { items: InviteItem[] };

// ─── Constants ───────────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<BusinessRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return value;
  }
}

export function canChangeRole(
  actorRole: BusinessRole | null | undefined,
  target: Member,
  currentUserId: string | null
) {
  if (!actorRole) return false;
  if (target.userId === currentUserId) return false;
  if (target.role === 'OWNER') return false;
  if (actorRole === 'OWNER') return true;
  return actorRole === 'ADMIN' && (target.role === 'MEMBER' || target.role === 'VIEWER');
}

export function allowedRoles(actorRole: BusinessRole | null | undefined, target: Member): BusinessRole[] {
  if (actorRole === 'OWNER') return ['ADMIN', 'MEMBER', 'VIEWER'];
  if (actorRole === 'ADMIN' && (target.role === 'MEMBER' || target.role === 'VIEWER')) {
    return ['MEMBER', 'VIEWER'];
  }
  return [];
}

export function canEditEmployeeProfile(
  actorRole: BusinessRole | null | undefined,
  actorPermissions: BusinessPermission[] | undefined,
  target: Member
) {
  const hasFlag = actorPermissions?.includes('TEAM_EDIT');
  if (actorRole === 'OWNER' || actorRole === 'ADMIN') return true;
  if (hasFlag && target.role !== 'OWNER') return true;
  return false;
}

export function canRemove(
  actorRole: BusinessRole | null | undefined,
  target: Member,
  currentUserId: string | null
) {
  if (!actorRole) return false;
  if (target.userId === currentUserId) return false;
  if (target.role === 'OWNER') return false;
  if (actorRole === 'OWNER') return true;
  return actorRole === 'ADMIN' && (target.role === 'MEMBER' || target.role === 'VIEWER');
}

export function isValidRole(role: string): role is BusinessRole {
  return role === 'OWNER' || role === 'ADMIN' || role === 'MEMBER' || role === 'VIEWER';
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
