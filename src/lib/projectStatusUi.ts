import { isProjectActive, isProjectInactive, isProjectPlanned } from '@/lib/projectStatus';

const STATUS_LABELS: Record<string, string> = {
  PLANNED: 'En attente',
  ACTIVE: 'Actif',
  ON_HOLD: 'En pause',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulé',
};

export type ProjectScopeLabel = 'Actif' | 'En attente' | 'Inactif';
export type ProjectScopeVariant = 'personal' | 'pro' | 'neutral' | 'performance';

export function getProjectStatusLabelFR(status?: string | null): string {
  if (!status) return '—';
  const normalized = status.toUpperCase();
  return STATUS_LABELS[normalized] ?? status;
}

export function getProjectScopeLabelFR(status?: string | null, archivedAt?: string | null): ProjectScopeLabel {
  if (isProjectActive(status, archivedAt)) return 'Actif';
  if (isProjectPlanned(status, archivedAt)) return 'En attente';
  return 'Inactif';
}

export function getProjectScopeVariant(status?: string | null, archivedAt?: string | null): ProjectScopeVariant {
  const scope = getProjectScopeLabelFR(status, archivedAt);
  if (scope === 'Actif') return 'personal';
  if (scope === 'En attente') return 'pro';
  return 'neutral';
}

function toDateOnly(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function isProjectOverdue(
  endDate?: string | null,
  status?: string | null,
  archivedAt?: string | null
): boolean {
  if (!endDate) return false;
  if (isProjectInactive(status, archivedAt)) return false;
  const end = toDateOnly(endDate);
  if (!end) return false;
  const today = new Date().toISOString().slice(0, 10);
  return end < today;
}

export function isProjectQuoteSigned(status?: string | null): boolean {
  const normalized = status?.toUpperCase();
  return normalized === 'SIGNED' || normalized === 'ACCEPTED';
}

export function isProjectDepositOk(status?: string | null): boolean {
  const normalized = status?.toUpperCase();
  return normalized === 'PAID' || normalized === 'NOT_REQUIRED';
}

export function shouldWarnProjectCompletion(
  quoteStatus?: string | null,
  depositStatus?: string | null
): boolean {
  return !(isProjectQuoteSigned(quoteStatus) && isProjectDepositOk(depositStatus));
}
