import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

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
  const nextTask = tasks
    .filter((t) => t.status !== 'DONE')
    .sort((a, b) => (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) - (b.dueDate ? new Date(b.dueDate).getTime() : Infinity))[0];

  return (
    <Card className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface)]/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{service.name}</p>
          <p className="text-xs text-[var(--text-secondary)]">
            {done}/{total || '—'} tâches · {progress}%
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={`/app/pro/${businessId}/tasks?projectId=${projectId}`}>Voir</Link>
        </Button>
      </div>
      <div className="mt-3">
        <ProgressBar value={progress} />
      </div>
      <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
        {nextTask ? (
          <p className="text-xs text-[var(--text-primary)]">
            Prochaine tâche : {nextTask.title} · {formatDate(nextTask.dueDate)}
          </p>
        ) : null}
        {tasks.slice(0, 3).map((task) => (
          <div
            key={task.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-[var(--text-primary)]">{task.title}</p>
              <p className="text-[11px]">
                {formatStatus(task.status)} · {task.assigneeName || task.assigneeEmail || 'Non assigné'}
              </p>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">{formatDate(task.dueDate)}</p>
          </div>
        ))}
        {tasks.length === 0 ? <p className="text-xs text-[var(--text-secondary)]">Aucune tâche associée.</p> : null}
      </div>
    </Card>
  );
}
