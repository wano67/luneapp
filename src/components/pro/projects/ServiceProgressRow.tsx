import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatTaskStatus, getTaskStatusBadgeClasses } from '@/lib/taskStatusUi';

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


export function ServiceProgressRow({
  service,
  tasks,
  businessId,
  projectId,
  onTaskClick,
}: {
  service: ServiceRow;
  tasks: ServiceTask[];
  businessId: string;
  projectId: string;
  onTaskClick?: (taskId: string) => void;
}) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'DONE').length;
  const progress =
    total > 0
      ? Math.round(
          tasks.reduce((sum, t) => sum + (t.status === 'DONE' ? 100 : 0), 0) /
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
    <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--surface-2)]/40 overflow-hidden">
      {/* Service header — clickable to expand */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--surface-2)]/80"
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{service.name}</p>
            <span className="shrink-0 text-[11px] font-medium text-[var(--text-faint)]">
              {done}/{total}
            </span>
          </div>
          <div className="mt-1.5">
            <ProgressBar value={progress} />
          </div>
        </div>
        <div className="shrink-0 flex items-center justify-center rounded-full w-7 h-7" style={{ background: 'var(--surface-2)' }}>
          {expanded ? <ChevronUp size={14} className="text-[var(--text-faint)]" /> : <ChevronDown size={14} className="text-[var(--text-faint)]" />}
        </div>
      </button>

      {/* Expanded task list */}
      {expanded ? (
        <div className="border-t border-[var(--border)]/40 px-4 py-3 space-y-2">
          {previewTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => onTaskClick?.(task.id)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-[var(--surface)]/80"
            >
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm text-[var(--text-primary)]">{task.title}</p>
                <p className="text-[11px] text-[var(--text-faint)]">
                  {task.assigneeName || task.assigneeEmail || 'Non assigné'}
                  {task.dueDate ? ` · ${formatDate(task.dueDate)}` : ''}
                </p>
              </div>
              <span
                className={cn(
                  'shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                  getTaskStatusBadgeClasses(task.status)
                )}
              >
                {formatTaskStatus(task.status)}
              </span>
            </button>
          ))}
          {tasks.length === 0 ? (
            <p className="text-xs text-[var(--text-faint)] px-3">Aucune tâche associée.</p>
          ) : null}
          {tasks.length > 0 && previewTasks.length === 0 ? (
            <p className="text-xs text-[var(--text-faint)] px-3">Toutes les tâches sont terminées.</p>
          ) : null}
          {showMore ? (
            <Link
              href={`/app/pro/${businessId}/tasks?projectId=${projectId}`}
              className="inline-flex px-3 text-xs font-semibold text-[var(--accent-strong)] hover:underline"
            >
              Voir toutes les tâches
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
