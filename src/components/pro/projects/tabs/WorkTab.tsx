"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Users, Briefcase, ArrowUpRight } from 'lucide-react';
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
import { useRowSelection } from '@/app/app/components/selection/useRowSelection';
import type { TaskItem, MemberItem, OrganizationUnitItem } from '@/components/pro/projects/hooks/useProjectDataLoaders';

function formatEstimatedTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

type ServiceOption = { id: string; name: string };

type WorkTabTask = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  assignees?: Array<{ userId: string; email: string; name: string | null }>;
  organizationUnitName?: string | null;
  projectServiceName?: string | null;
  checklistCount?: number;
  checklistDoneCount?: number;
  estimatedMinutes?: number | null;
  isBlocked?: boolean;
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
  statusFilter: 'TODO' | 'DONE' | 'all';
  onStatusFilterChange: (value: 'TODO' | 'DONE' | 'all') => void;
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
  currentUserId?: string | null;
  onQuickAddTask: (title: string, opts?: { projectServiceId?: string; assigneeUserIds?: string[]; organizationUnitId?: string }) => Promise<void>;
  onUpdateTask: (taskId: string, payload: Record<string, unknown>) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  services?: ServiceOption[];
  organizationUnits?: OrganizationUnitItem[];
  initialOpenTaskId?: string | null;
  onInitialTaskConsumed?: () => void;
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
  businessId,
  projectId,
  tasks,
  members,
  isAdmin,
  currentUserId,
  onQuickAddTask,
  onUpdateTask,
  onDeleteTask,
  services,
  organizationUnits,
  initialOpenTaskId,
  onInitialTaskConsumed,
}: WorkTabProps) {
  const [workView, setWorkView] = useState<WorkView>('list');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const selection = useRowSelection();

  const selectedTask = selectedTaskId
    ? tasks.find((t) => t.id === selectedTaskId) ?? null
    : null;

  const openTask = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
  }, []);

  const closePanel = useCallback(() => {
    setSelectedTaskId(null);
  }, []);

  // Auto-open task from other tabs (e.g. OverviewTab click)
  useEffect(() => {
    if (initialOpenTaskId) {
      setSelectedTaskId(initialOpenTaskId);
      onInitialTaskConsumed?.();
    }
  }, [initialOpenTaskId, onInitialTaskConsumed]);

  const allTaskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);

  const handleBulkAssign = useCallback(async (assigneeUserId: string | null) => {
    if (selection.selectedCount === 0) return;
    setBulkLoading(true);
    try {
      await Promise.all(
        selection.selectedArray.map((id) => onUpdateTask(id, { assigneeUserId }))
      );
      selection.clear();
    } finally {
      setBulkLoading(false);
    }
  }, [selection, onUpdateTask]);

  const handleBulkService = useCallback(async (projectServiceId: string | null) => {
    if (selection.selectedCount === 0) return;
    setBulkLoading(true);
    try {
      await Promise.all(
        selection.selectedArray.map((id) => onUpdateTask(id, { projectServiceId }))
      );
      selection.clear();
    } finally {
      setBulkLoading(false);
    }
  }, [selection, onUpdateTask]);

  const totalEstimatedMinutes = tasks.reduce((sum, t) => sum + (t.estimatedMinutes ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Sub-navigation */}
      <div className="flex flex-col gap-3">
        {/* Row 1: View mode + estimated time + link to global tasks */}
        <div className="flex items-center gap-3">
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
          {totalEstimatedMinutes > 0 ? (
            <span className="text-xs text-[var(--text-secondary)]">
              ~{formatEstimatedTime(totalEstimatedMinutes)} estimées
            </span>
          ) : null}
          <Link
            href={`/app/pro/${businessId}/tasks?projectId=${projectId}`}
            className="ml-auto inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
          >
            Toutes les tâches
            <ArrowUpRight size={12} />
          </Link>
        </div>

        {/* Row 2: Status filter (list view only) */}
        {workView === 'list' ? (
          <TabsPills
            items={[
              { key: 'all', label: 'Toutes' },
              { key: 'TODO', label: 'À faire' },
              { key: 'DONE', label: 'Terminées' },
            ]}
            value={statusFilter}
            onChange={(key) => onStatusFilterChange(key as typeof statusFilter)}
            ariaLabel="Filtrer tâches"
            variant="secondary"
          />
        ) : null}
      </div>

      {/* Quick-add — visible for MEMBER and above */}
      <TaskQuickAdd onAdd={onQuickAddTask} services={services} />

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
          selection={selection}
          allTaskIds={allTaskIds}
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
        currentUserId={currentUserId}
        onUpdate={onUpdateTask}
        onDelete={onDeleteTask}
        services={services}
        organizationUnits={organizationUnits}
      />

      {/* Bulk action bar */}
      {isAdmin && selection.selectedCount > 0 ? (
        <BulkTaskBar
          count={selection.selectedCount}
          onClear={selection.clear}
          members={members}
          services={services}
          onAssign={handleBulkAssign}
          onService={handleBulkService}
          loading={bulkLoading}
        />
      ) : null}
    </div>
  );
}

// ─── Bulk Task Bar ──────────────────────────────────────────────────────────

function BulkTaskBar({
  count,
  onClear,
  members,
  services,
  onAssign,
  onService,
  loading,
}: {
  count: number;
  onClear: () => void;
  members: MemberItem[];
  services?: ServiceOption[];
  onAssign: (assigneeUserId: string | null) => Promise<void>;
  onService: (projectServiceId: string | null) => Promise<void>;
  loading: boolean;
}) {
  if (count === 0) return null;

  const bar = (
    <div
      className="fixed inset-x-0 z-[59] border-t border-[var(--border)] bg-[var(--surface)]/95 shadow-lg shadow-black/10 backdrop-blur md:inset-x-auto md:bottom-4 md:left-1/2 md:w-[min(960px,calc(100%-24px))] md:-translate-x-1/2 md:rounded-xl md:border"
      style={{ bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between">
        {/* Count + deselect */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {count} tâche{count > 1 ? 's' : ''}
          </span>
          <Button size="sm" variant="ghost" onClick={onClear} disabled={loading} className="md:hidden">
            Désélectionner
          </Button>
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-2">
          {/* Assign to member */}
          <div className="flex flex-1 items-center gap-1.5 md:flex-initial">
            <Users size={14} className="shrink-0 text-[var(--text-secondary)]" />
            <select
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none md:w-auto"
              defaultValue=""
              disabled={loading}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '') return;
                void onAssign(v === '__none__' ? null : v);
                e.target.value = '';
              }}
            >
              <option value="" disabled>Assigner à…</option>
              <option value="__none__">Non assigné</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>{m.name ?? m.email}</option>
              ))}
            </select>
          </div>

          {/* Assign to service */}
          {services && services.length > 0 ? (
            <div className="flex flex-1 items-center gap-1.5 md:flex-initial">
              <Briefcase size={14} className="shrink-0 text-[var(--text-secondary)]" />
              <select
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none md:w-auto"
                defaultValue=""
                disabled={loading}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '') return;
                  void onService(v === '__none__' ? null : v);
                  e.target.value = '';
                }}
              >
                <option value="" disabled>Service…</option>
                <option value="__none__">Aucun service</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          ) : null}

          <Button size="sm" variant="ghost" onClick={onClear} disabled={loading} className="hidden md:inline-flex">
            Tout désélectionner
          </Button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return bar;
  return createPortal(bar, document.body);
}

// ─── List View (extracted from old WorkTab) ──────────────────────────────────

type SelectionHandle = {
  toggle: (id: string) => void;
  isSelected: (id: string) => boolean;
  toggleAll: (ids: string[]) => void;
  allSelected: (ids: string[]) => boolean;
  someSelected: (ids: string[]) => boolean;
  selectedCount: number;
};

function ListView({
  tasksByAssignee,
  subtasksByParentId,
  taskGroupExpanded,
  onTaskGroupToggle,
  taskRowExpanded,
  onTaskRowToggle,
  onTaskClick,
  selection,
  allTaskIds,
}: {
  tasksByAssignee: TaskGroup[];
  subtasksByParentId: Record<string, WorkTabTask[]>;
  taskGroupExpanded: Record<string, boolean>;
  onTaskGroupToggle: (key: string, expanded: boolean) => void;
  taskRowExpanded: Record<string, boolean>;
  onTaskRowToggle: (taskId: string, rowExpanded: boolean) => void;
  onTaskClick: (taskId: string) => void;
  selection: SelectionHandle;
  allTaskIds: string[];
}) {
  if (!tasksByAssignee.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
        Aucune tâche. Utilisez le champ ci-dessus pour en créer.
      </div>
    );
  }

  const hasSelection = selection.selectedCount > 0;

  return (
    <div className="space-y-3">
      {/* Select all row — shown when any task is selected */}
      {hasSelection ? (
        <div className="flex items-center gap-2 px-1">
          <input
            type="checkbox"
            checked={selection.allSelected(allTaskIds)}
            ref={(el) => {
              if (el) el.indeterminate = selection.someSelected(allTaskIds) && !selection.allSelected(allTaskIds);
            }}
            onChange={() => selection.toggleAll(allTaskIds)}
            className="accent-[var(--accent)]"
          />
          <span className="text-xs text-[var(--text-secondary)]">Tout sélectionner</span>
        </div>
      ) : null}

      {tasksByAssignee.map((group) => {
        const total = group.tasks.length;
        const done = group.tasks.filter((t) => t.status === 'DONE').length;
        const blocked = group.tasks.filter((t) => t.isBlocked).length;
        const remaining = total - done;
        const expanded = taskGroupExpanded[group.key] ?? false;
        const previewTasks = expanded ? group.tasks : group.tasks.slice(0, 5);
        const showToggle = group.tasks.length > 5;
        const groupTaskIds = group.tasks.map((t) => t.id);
        return (
          <Card
            key={group.key}
            className="rounded-2xl border border-[var(--border)]/70 bg-[var(--surface)]/80 p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* Group-level checkbox */}
                <input
                  type="checkbox"
                  checked={selection.allSelected(groupTaskIds)}
                  ref={(el) => {
                    if (el) el.indeterminate = selection.someSelected(groupTaskIds) && !selection.allSelected(groupTaskIds);
                  }}
                  onChange={() => selection.toggleAll(groupTaskIds)}
                  className="accent-[var(--accent)]"
                />
                <InitialsAvatar name={group.name} email={group.email} size={30} />
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{group.label}</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {done}/{total} terminées{blocked > 0 ? ` · ${blocked} bloquée${blocked > 1 ? 's' : ''}` : ''} · {remaining} restante{remaining > 1 ? 's' : ''}
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
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selection.isSelected(task.id)}
                        onChange={() => selection.toggle(task.id)}
                        className="shrink-0 accent-[var(--accent)]"
                      />
                    <button
                      type="button"
                      onClick={() => onTaskClick(task.id)}
                      className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-2 text-left text-sm transition hover:border-[var(--border)] hover:bg-[var(--surface)]"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {/* Multi-assignee stacked avatars */}
                        {task.assignees && task.assignees.length > 0 ? (
                          <div className="flex shrink-0 -space-x-1.5">
                            {task.assignees.slice(0, 3).map((a) => (
                              <InitialsAvatar key={a.userId} name={a.name} email={a.email} size={22} />
                            ))}
                            {task.assignees.length > 3 ? (
                              <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] text-[9px] font-semibold text-[var(--text-secondary)]">
                                +{task.assignees.length - 3}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <InitialsAvatar name={task.assigneeName} email={task.assigneeEmail} size={22} />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-[var(--text-primary)]">
                            {task.isBlocked ? (
                              <span className="mr-1.5 inline-flex items-center rounded-full border border-[var(--danger-border)] bg-[var(--danger-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--danger)]">
                                Bloqué
                              </span>
                            ) : null}
                            {task.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                                getStatusBadgeClasses(task.status)
                              )}
                            >
                              {formatTaskStatus(task.status)}
                            </span>
                            {task.organizationUnitName ? (
                              <span className="inline-flex rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">
                                {task.organizationUnitName}
                              </span>
                            ) : null}
                            {task.estimatedMinutes ? (
                              <span className="inline-flex rounded-full border border-[var(--border)]/50 bg-[var(--surface-2)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
                                {formatEstimatedTime(task.estimatedMinutes)}
                              </span>
                            ) : null}
                            {task.projectServiceName ? (
                              <span className="inline-flex rounded-full border border-[var(--border)]/50 bg-[var(--surface-2)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
                                {task.projectServiceName}
                              </span>
                            ) : null}
                          </div>
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
                    </div>
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
