"use client";

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import {
  InitialsAvatar,
  formatDate,
  formatTaskStatus,
  getStatusBadgeClasses,
} from '@/components/pro/projects/workspace-ui';
import type { TaskItem } from '@/components/pro/projects/hooks/useProjectDataLoaders';

const PHASE_ORDER = ['CADRAGE', 'UX', 'DESIGN', 'DEV', 'SEO', 'LAUNCH', 'FOLLOW_UP'] as const;
const PHASE_LABELS: Record<string, string> = {
  CADRAGE: 'Cadrage',
  UX: 'UX',
  DESIGN: 'Design',
  DEV: 'Développement',
  SEO: 'SEO',
  LAUNCH: 'Lancement',
  FOLLOW_UP: 'Suivi',
};

type RoadmapViewProps = {
  tasks: TaskItem[];
  onTaskClick: (taskId: string) => void;
};

export function RoadmapView({ tasks, onTaskClick }: RoadmapViewProps) {
  const columns = useMemo(() => {
    const grouped = new Map<string, TaskItem[]>();
    for (const phase of PHASE_ORDER) {
      grouped.set(phase, []);
    }
    grouped.set('NONE', []);

    for (const task of tasks) {
      if (!task.parentTaskId) {
        const key = task.phase && PHASE_LABELS[task.phase] ? task.phase : 'NONE';
        grouped.get(key)!.push(task);
      }
    }

    return [...PHASE_ORDER, 'NONE' as const].map((key) => ({
      key,
      label: key === 'NONE' ? 'Sans phase' : PHASE_LABELS[key],
      tasks: grouped.get(key) ?? [],
    })).filter((col) => col.tasks.length > 0);
  }, [tasks]);

  if (columns.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
        Aucune tâche. Utilisez le champ ci-dessus pour en créer.
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 md:flex-row">
      {columns.map((col) => {
        const done = col.tasks.filter((t) => t.status === 'DONE').length;
        const total = col.tasks.length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;

        return (
          <div key={col.key} className="min-w-[240px] flex-1 space-y-2">
            {/* Column header */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  {col.label}
                </p>
                <span className="text-[11px] text-[var(--text-secondary)]">
                  {done}/{total}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
                <div
                  className="h-full rounded-full bg-[var(--success)] transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {/* Task cards */}
            <div className="space-y-2">
              {col.tasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onTaskClick(task.id)}
                  className="w-full text-left"
                >
                  <Card className="space-y-1.5 rounded-xl border border-[var(--border)]/60 bg-[var(--surface)]/80 p-3 shadow-sm transition hover:border-[var(--border)] hover:shadow-md">
                    <p className="text-sm font-medium text-[var(--text-primary)] line-clamp-2">
                      {task.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                          getStatusBadgeClasses(task.status)
                        )}
                      >
                        {formatTaskStatus(task.status)}
                      </span>
                      {task.assigneeName || task.assigneeEmail ? (
                        <InitialsAvatar name={task.assigneeName} email={task.assigneeEmail} size={18} />
                      ) : null}
                      {task.dueDate ? (
                        <span className="text-[10px] text-[var(--text-secondary)]">
                          {formatDate(task.dueDate)}
                        </span>
                      ) : null}
                    </div>
                  </Card>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
