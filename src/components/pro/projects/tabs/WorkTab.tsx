"use client";

import { useCallback, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import {
  formatDate,
  formatTaskStatus,
  getStatusBadgeClasses,
  InitialsAvatar,
} from '@/components/pro/projects/workspace-ui';
import { TabsPills } from '@/components/pro/TabsPills';
import { TaskQuickAdd } from '@/components/pro/projects/work/TaskQuickAdd';
import { TaskSidePanel } from '@/components/pro/projects/work/TaskSidePanel';
import { RoadmapView } from '@/components/pro/projects/work/RoadmapView';
import { GanttChart } from '@/components/pro/projects/work/GanttChart';
import type { TaskItem, MemberItem } from '@/components/pro/projects/hooks/useProjectDataLoaders';

type ServiceOption = { id: string; name: string };

type WorkTabTask = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  projectServiceName?: string | null;
  checklistCount?: number;
  checklistDoneCount?: number;
};

type TaskGroup = {
  key: string;
  label: string;
  name?: string | null;
  email?: string | null;
  tasks: WorkTabTask[];
};

type WorkView = 'list' | 'roadmap' | 'gantt';

export type WorkTabProps = {
  tasksByAssignee: TaskGroup[];
  subtasksByParentId: Record<string, WorkTabTask[]>;
  statusFilter: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'all';
  onStatusFilterChange: (value: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'all') => void;
  taskGroupExpanded: Record<string, boolean>;
  onTaskGroupToggle: (key: string, expanded: boolean) => void;
  taskRowExpanded: Record<string, boolean>;
  onTaskRowToggle: (taskId: string, rowExpanded: boolean) => void;
  businessId: string;
  projectId: string;
  // New props
  tasks: TaskItem[];
  members: MemberItem[];
  isAdmin: boolean;
  onQuickAddTask: (title: string, projectServiceId?: string) => Promise<void>;
  onUpdateTask: (taskId: string, payload: Record<string, unknown>) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  services?: ServiceOption[];
};

export function WorkTab({
  tasksByAssignee,
  subtasksByParentId,
  statusFilter,
  onStatusFilterChange,
  taskGroupExpanded,
  onTaskGroupToggle,
  taskRowExpanded,
  onTaskRowToggle,
  tasks,
  members,
  isAdmin,
  onQuickAddTask,
  onUpdateTask,
  onDeleteTask,
  services,
}: WorkTabProps) {
  const [workView, setWorkView] = useState<WorkView>('list');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const selectedTask = selectedTaskId
    ? tasks.find((t) => t.id === selectedTaskId) ?? null
    : null;

  const openTask = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
  }, []);

  const closePanel = useCallback(() => {
    setSelectedTaskId(null);
  }, []);

  return (
    <div className="space-y-4">
      {/* Sub-navigation: List / Roadmap / Gantt */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabsPills
          items={[
            { key: 'list', label: 'Liste' },
            { key: 'roadmap', label: 'Roadmap' },
            { key: 'gantt', label: 'Gantt' },
          ]}
          value={workView}
          onChange={(key) => setWorkView(key as WorkView)}
          ariaLabel="Vue travail"
        />
        {workView === 'list' ? (
          <TabsPills
            items={[
              { key: 'TODO', label: 'À faire' },
              { key: 'IN_PROGRESS', label: 'En cours' },
              { key: 'DONE', label: 'Terminées' },
              { key: 'all', label: 'Toutes' },
            ]}
            value={statusFilter}
            onChange={(key) => onStatusFilterChange(key as typeof statusFilter)}
            ariaLabel="Filtrer tâches"
          />
        ) : null}
      </div>

      {/* Quick-add */}
      {isAdmin ? (
        <TaskQuickAdd onAdd={onQuickAddTask} services={services} />
      ) : null}

      {/* Views */}
      {workView === 'list' ? (
        <ListView
          tasksByAssignee={tasksByAssignee}
          subtasksByParentId={subtasksByParentId}
          taskGroupExpanded={taskGroupExpanded}
          onTaskGroupToggle={onTaskGroupToggle}
          taskRowExpanded={taskRowExpanded}
          onTaskRowToggle={onTaskRowToggle}
          onTaskClick={openTask}
        />
      ) : workView === 'roadmap' ? (
        <RoadmapView tasks={tasks} onTaskClick={openTask} />
      ) : (
        <GanttChart tasks={tasks} onTaskClick={openTask} />
      )}

      {/* Side panel */}
      <TaskSidePanel
        task={selectedTask}
        open={Boolean(selectedTask)}
        onClose={closePanel}
        members={members}
        isAdmin={isAdmin}
        onUpdate={onUpdateTask}
        onDelete={onDeleteTask}
        services={services}
      />
    </div>
  );
}

// ─── List View (extracted from old WorkTab) ──────────────────────────────────

function ListView({
  tasksByAssignee,
  subtasksByParentId,
  taskGroupExpanded,
  onTaskGroupToggle,
  taskRowExpanded,
  onTaskRowToggle,
  onTaskClick,
}: {
  tasksByAssignee: TaskGroup[];
  subtasksByParentId: Record<string, WorkTabTask[]>;
  taskGroupExpanded: Record<string, boolean>;
  onTaskGroupToggle: (key: string, expanded: boolean) => void;
  taskRowExpanded: Record<string, boolean>;
  onTaskRowToggle: (taskId: string, rowExpanded: boolean) => void;
  onTaskClick: (taskId: string) => void;
}) {
  if (!tasksByAssignee.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
        Aucune tâche. Utilisez le champ ci-dessus pour en créer.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasksByAssignee.map((group) => {
        const total = group.tasks.length;
        const done = group.tasks.filter((t) => t.status === 'DONE').length;
        const inProgress = group.tasks.filter((t) => t.status === 'IN_PROGRESS').length;
        const remaining = total - done;
        const expanded = taskGroupExpanded[group.key] ?? false;
        const previewTasks = expanded ? group.tasks : group.tasks.slice(0, 5);
        const showToggle = group.tasks.length > 5;
        return (
          <Card
            key={group.key}
            className="rounded-2xl border border-[var(--border)]/70 bg-[var(--surface)]/80 p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <InitialsAvatar name={group.name} email={group.email} size={30} />
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{group.label}</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {done}/{total} terminées · {inProgress} en cours · {remaining} restantes
                  </p>
                </div>
              </div>
              {showToggle ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onTaskGroupToggle(group.key, !expanded)}
                >
                  {expanded ? 'Voir moins' : 'Voir +'}
                </Button>
              ) : null}
            </div>
            <div className="mt-3 space-y-2">
              {previewTasks.map((task) => {
                const childTasks = subtasksByParentId[task.id] ?? [];
                const childDone = childTasks.filter((t) => t.status === 'DONE').length;
                const checklistTotal = task.checklistCount ?? 0;
                const checklistDone = task.checklistDoneCount ?? 0;
                const indicator =
                  childTasks.length > 0
                    ? `Sous-tâches ${childDone}/${childTasks.length}`
                    : checklistTotal > 0
                      ? `Checklist ${checklistDone}/${checklistTotal}`
                      : null;
                const hasChildren = childTasks.length > 0;
                const rowExpanded = taskRowExpanded[task.id] ?? false;
                return (
                  <div key={task.id} className="space-y-2">
                    <button
                      type="button"
                      onClick={() => onTaskClick(task.id)}
                      className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-2 text-left text-sm transition hover:border-[var(--border)] hover:bg-[var(--surface)]"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <InitialsAvatar
                          name={task.assigneeName}
                          email={task.assigneeEmail}
                          size={22}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-[var(--text-primary)]">{task.title}</p>
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                              getStatusBadgeClasses(task.status)
                            )}
                          >
                            {formatTaskStatus(task.status)}
                          </span>
                          {task.projectServiceName ? (
                            <span className="inline-flex rounded-full border border-[var(--border)]/50 bg-[var(--surface-2)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
                              {task.projectServiceName}
                            </span>
                          ) : null}
                          {indicator ? (
                            <p className="text-[11px] text-[var(--text-secondary)]">{indicator}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                        {hasChildren ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              onTaskRowToggle(task.id, !rowExpanded);
                            }}
                          >
                            {rowExpanded ? 'Réduire' : 'Sous-tâches'}
                          </Button>
                        ) : null}
                        <span>{task.dueDate ? formatDate(task.dueDate) : '—'}</span>
                      </div>
                    </button>
                    {hasChildren && rowExpanded ? (
                      <div className="ml-6 space-y-2 border-l border-[var(--border)]/60 pl-4">
                        {childTasks.map((child) => (
                          <button
                            key={child.id}
                            type="button"
                            onClick={() => onTaskClick(child.id)}
                            className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)]/50 bg-[var(--surface-2)]/60 px-3 py-2 text-left text-sm transition hover:border-[var(--border)] hover:bg-[var(--surface)]"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[var(--text-primary)]">{child.title}</p>
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                                  getStatusBadgeClasses(child.status)
                                )}
                              >
                                {formatTaskStatus(child.status)}
                              </span>
                            </div>
                            <span className="text-[11px] text-[var(--text-secondary)]">
                              {child.dueDate ? formatDate(child.dueDate) : '—'}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
