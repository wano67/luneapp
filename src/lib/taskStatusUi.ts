import type { TaskStatus } from '@/generated/prisma';

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'À faire',
  IN_PROGRESS: 'En cours',
  DONE: 'Terminée',
};

export const TASK_STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'TODO', label: 'À faire' },
  { value: 'IN_PROGRESS', label: 'En cours' },
  { value: 'DONE', label: 'Terminée' },
];

export function formatTaskStatus(status: string): string {
  return TASK_STATUS_LABELS[status as TaskStatus] ?? (status || '—');
}

export const TASK_STATUS_CLASSES: Record<TaskStatus, string> = {
  DONE: 'border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success)]',
  IN_PROGRESS: 'border-[var(--accent-strong)] bg-[var(--accent)]/10 text-[var(--accent)]',
  TODO: 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]',
};

export function getTaskStatusBadgeClasses(status: string): string {
  return (
    TASK_STATUS_CLASSES[status as TaskStatus] ??
    'border-[var(--border)]/60 bg-[var(--surface-2)] text-[var(--text-secondary)]'
  );
}
