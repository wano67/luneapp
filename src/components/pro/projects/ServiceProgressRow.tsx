import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';

export type ServiceRow = {
  id: string;
  name: string;
};

export type ServiceTask = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  projectServiceId: string | null;
  progress?: number;
};

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="h-2 w-full rounded-full bg-[var(--surface-2)]">
      <div className="h-2 rounded-full bg-[var(--accent)] transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return '—';
  }
}

function formatStatus(status: string) {
  if (status === 'DONE') return 'Terminée';
  if (status === 'IN_PROGRESS') return 'En cours';
  if (status === 'TODO') return 'À faire';
  return status || '—';
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  DONE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  IN_PROGRESS: 'border-amber-200 bg-amber-50 text-amber-700',
  TODO: 'border-slate-200 bg-slate-50 text-slate-700',
};

function getStatusBadgeClasses(status: string) {
  return STATUS_BADGE_STYLES[status] ?? 'border-[var(--border)]/60 bg-[var(--surface-2)] text-[var(--text-secondary)]';
}

export function ServiceProgressRow({
  service,
  tasks,
  businessId,
  projectId,
}: {
  service: ServiceRow;
  tasks: ServiceTask[];
  businessId: string;
  projectId: string;
}) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'DONE').length;
  const progress =
    total > 0
      ? Math.round(
          tasks.reduce((sum, t) => sum + (t.status === 'DONE' ? 100 : t.status === 'IN_PROGRESS' ? t.progress ?? 0 : 0), 0) /
            total
        )
      : 0;
  const [expanded, setExpanded] = useState(false);
  const upcomingTasks = tasks
    .filter((t) => t.status !== 'DONE')
    .sort((a, b) => (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) - (b.dueDate ? new Date(b.dueDate).getTime() : Infinity));
  const previewTasks = upcomingTasks.slice(0, 3);
  const showMore = upcomingTasks.length > previewTasks.length;

  return (
    <Card className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface)]/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{service.name}</p>
          <p className="text-xs text-[var(--text-secondary)]">
            {done}/{total || '—'} tâches · {progress}%
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </Button>
      </div>
      <div className="mt-3">
        <ProgressBar value={progress} />
      </div>
      {expanded ? (
        <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
          {previewTasks.map((task) => (
            <Link
              key={task.id}
              href={`/app/pro/${businessId}/tasks/${task.id}`}
              className="block rounded-lg border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-2 transition hover:border-[var(--border)] hover:bg-[var(--surface)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[var(--text-primary)]">{task.title}</p>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    {task.assigneeName || task.assigneeEmail || 'Non assigné'}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      getStatusBadgeClasses(task.status)
                    )}
                  >
                    {formatStatus(task.status)}
                  </span>
                  <span>{formatDate(task.dueDate)}</span>
                </div>
              </div>
            </Link>
          ))}
          {tasks.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)]">Aucune tâche associée.</p>
          ) : null}
          {tasks.length > 0 && previewTasks.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)]">Toutes les tâches sont terminées.</p>
          ) : null}
          {showMore ? (
            <Link
              href={`/app/pro/${businessId}/tasks?projectId=${projectId}`}
              className="inline-flex text-xs font-semibold text-[var(--accent-strong)] hover:underline"
            >
              Voir +
            </Link>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
