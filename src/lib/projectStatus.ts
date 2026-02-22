const INACTIVE_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'ON_HOLD']);

export function isProjectActive(status?: string | null, archivedAt?: string | null): boolean {
  if (archivedAt) return false;
  return status?.toUpperCase() === 'ACTIVE';
}

export function isProjectPlanned(status?: string | null, archivedAt?: string | null): boolean {
  if (archivedAt) return false;
  return status?.toUpperCase() === 'PLANNED';
}

export function isProjectInactive(status?: string | null, archivedAt?: string | null): boolean {
  if (archivedAt) return true;
  const normalized = status?.toUpperCase();
  return normalized ? INACTIVE_STATUSES.has(normalized) : false;
}
