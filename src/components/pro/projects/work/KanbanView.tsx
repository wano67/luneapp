"use client";

import { useCallback, useRef, useState } from 'react';
import { GripVertical, AlertTriangle, Calendar, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import {
  InitialsAvatar,
  formatDate,
} from '@/components/pro/projects/workspace-ui';
import type { TaskItem } from '@/components/pro/projects/hooks/useProjectDataLoaders';

type KanbanColumn = 'TODO' | 'IN_PROGRESS' | 'DONE';

const COLUMNS: { key: KanbanColumn; label: string; color: string; bgClass: string }[] = [
  {
    key: 'TODO',
    label: 'À faire',
    color: 'var(--text-secondary)',
    bgClass: 'border-[var(--border)]',
  },
  {
    key: 'IN_PROGRESS',
    label: 'En cours',
    color: 'var(--accent)',
    bgClass: 'border-[var(--accent-strong)]',
  },
  {
    key: 'DONE',
    label: 'Terminée',
    color: 'var(--success)',
    bgClass: 'border-[var(--success-border)]',
  },
];

function formatEstimatedTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

type ServiceMap = Record<string, string>;

type KanbanViewProps = {
  tasks: TaskItem[];
  onTaskClick: (taskId: string) => void;
  onUpdateTask: (taskId: string, payload: Record<string, unknown>) => Promise<void>;
  services?: Array<{ id: string; name: string }>;
};

export function KanbanView({ tasks, onTaskClick, onUpdateTask, services }: KanbanViewProps) {
  const serviceMap: ServiceMap = {};
  if (services) {
    for (const s of services) serviceMap[s.id] = s.name;
  }
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<KanbanColumn | null>(null);
  const [optimisticStatus, setOptimisticStatus] = useState<Record<string, KanbanColumn>>({});
  const dragCounter = useRef<Record<string, number>>({});

  const getTaskStatus = (task: TaskItem): KanbanColumn => {
    return (optimisticStatus[task.id] ?? task.status) as KanbanColumn;
  };

  const columnTasks: Record<KanbanColumn, TaskItem[]> = {
    TODO: [],
    IN_PROGRESS: [],
    DONE: [],
  };

  for (const task of tasks) {
    const status = getTaskStatus(task);
    if (status in columnTasks) {
      columnTasks[status].push(task);
    } else {
      columnTasks.TODO.push(task);
    }
  }

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
    // Set a custom drag image with slight opacity
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDraggedTaskId(null);
    setDragOverColumn(null);
    dragCounter.current = {};
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent, column: KanbanColumn) => {
    e.preventDefault();
    dragCounter.current[column] = (dragCounter.current[column] ?? 0) + 1;
    setDragOverColumn(column);
  }, []);

  const handleDragLeave = useCallback((column: KanbanColumn) => {
    dragCounter.current[column] = (dragCounter.current[column] ?? 0) - 1;
    if ((dragCounter.current[column] ?? 0) <= 0) {
      dragCounter.current[column] = 0;
      setDragOverColumn((prev) => (prev === column ? null : prev));
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetColumn: KanbanColumn) => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData('text/plain');
      if (!taskId) return;

      const task = tasks.find((t) => t.id === taskId);
      if (!task || task.status === targetColumn) {
        setDraggedTaskId(null);
        setDragOverColumn(null);
        dragCounter.current = {};
        return;
      }

      // Optimistic update
      setOptimisticStatus((prev) => ({ ...prev, [taskId]: targetColumn }));
      setDraggedTaskId(null);
      setDragOverColumn(null);
      dragCounter.current = {};

      try {
        await onUpdateTask(taskId, { status: targetColumn });
      } catch {
        // Revert on error
        setOptimisticStatus((prev) => {
          const next = { ...prev };
          delete next[taskId];
          return next;
        });
      }
    },
    [tasks, onUpdateTask]
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const colTasks = columnTasks[col.key];
        const isDragOver = dragOverColumn === col.key;

        return (
          <div
            key={col.key}
            className={cn(
              'flex flex-col rounded-2xl border bg-[var(--surface)]/50 transition-colors',
              col.bgClass,
              isDragOver && 'border-[var(--accent)] bg-[var(--accent)]/5',
            )}
            onDragEnter={(e) => handleDragEnter(e, col.key)}
            onDragLeave={() => handleDragLeave(col.key)}
            onDragOver={handleDragOver}
            onDrop={(e) => void handleDrop(e, col.key)}
          >
            {/* Column header */}
            <div className="flex items-center justify-between border-b border-[var(--border)]/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: col.color }}
                />
                <span className="text-sm font-semibold text-[var(--text)]">
                  {col.label}
                </span>
              </div>
              <span
                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold"
                style={{ background: `color-mix(in srgb, ${col.color} 15%, transparent)`, color: col.color }}
              >
                {colTasks.length}
              </span>
            </div>

            {/* Column body */}
            <div className="flex min-h-[120px] flex-col gap-2 p-3">
              {colTasks.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[var(--border)]/50 py-8 text-xs text-[var(--text-faint)]">
                  {isDragOver ? 'Déposer ici' : 'Aucune tâche'}
                </div>
              ) : (
                colTasks.map((task) => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    isDragging={draggedTaskId === task.id}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onClick={() => onTaskClick(task.id)}
                    serviceMap={serviceMap}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Kanban Card ─────────────────────────────────────────────────────────────

function KanbanCard({
  task,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
  serviceMap,
}: {
  task: TaskItem;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onClick: () => void;
  serviceMap: ServiceMap;
}) {
  const serviceName = task.projectServiceId ? serviceMap[task.projectServiceId] ?? null : null;
  const assignees = task.assignees && task.assignees.length > 0
    ? task.assignees
    : task.assigneeUserId
      ? [{ userId: task.assigneeUserId, email: task.assigneeEmail ?? '', name: task.assigneeName }]
      : [];

  const checklistTotal = task.checklistCount ?? 0;
  const checklistDone = task.checklistDoneCount ?? 0;

  return (
    <Card
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        'group cursor-grab border-[var(--border)]/60 bg-[var(--surface)] p-3 shadow-sm transition-all hover:border-[var(--border)] hover:shadow-md active:cursor-grabbing',
        isDragging && 'opacity-50',
        task.isBlocked && 'border-[var(--danger-border)]',
      )}
    >
      {/* Drag handle + title */}
      <div className="flex items-start gap-2">
        <GripVertical
          size={14}
          className="mt-0.5 shrink-0 text-[var(--text-faint)] opacity-0 transition-opacity group-hover:opacity-100"
        />
        <div className="min-w-0 flex-1">
          {task.isBlocked ? (
            <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--danger)]">
              <AlertTriangle size={10} />
              Bloqué
            </div>
          ) : null}
          <p className="text-sm font-medium leading-snug text-[var(--text)]">
            {task.title}
          </p>
        </div>
      </div>

      {/* Meta row */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {serviceName ? (
          <span className="rounded-full border border-[var(--border)]/50 bg-[var(--surface-2)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
            {serviceName}
          </span>
        ) : null}
        {task.estimatedMinutes ? (
          <span className="inline-flex items-center gap-0.5 rounded-full border border-[var(--border)]/50 bg-[var(--surface-2)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
            <Clock size={9} />
            {formatEstimatedTime(task.estimatedMinutes)}
          </span>
        ) : null}
        {checklistTotal > 0 ? (
          <span className={cn(
            'rounded-full border px-2 py-0.5 text-[10px]',
            checklistDone === checklistTotal
              ? 'border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success)]'
              : 'border-[var(--border)]/50 bg-[var(--surface-2)] text-[var(--text-secondary)]',
          )}>
            {checklistDone}/{checklistTotal}
          </span>
        ) : null}
      </div>

      {/* Bottom row: assignees + due date */}
      <div className="mt-2 flex items-center justify-between">
        {assignees.length > 0 ? (
          <div className="flex -space-x-1.5">
            {assignees.slice(0, 3).map((a) => (
              <InitialsAvatar key={a.userId} name={a.name} email={a.email} size={20} />
            ))}
            {assignees.length > 3 ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] text-[8px] font-semibold text-[var(--text-secondary)]">
                +{assignees.length - 3}
              </span>
            ) : null}
          </div>
        ) : (
          <div />
        )}
        {task.dueDate ? (
          <span className={cn(
            'inline-flex items-center gap-0.5 text-[10px]',
            new Date(task.dueDate) < new Date() && task.status !== 'DONE'
              ? 'font-semibold text-[var(--danger)]'
              : 'text-[var(--text-secondary)]',
          )}>
            <Calendar size={9} />
            {formatDate(task.dueDate)}
          </span>
        ) : null}
      </div>
    </Card>
  );
}
