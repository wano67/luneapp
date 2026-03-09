'use client';

import Link from 'next/link';
import { useEffect, useMemo, useCallback, useState } from 'react';
import { useParams } from 'next/navigation';
import { ClipboardList, ChevronRight, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { KpiCard } from '@/components/ui/kpi-card';
import { Skeleton, SkeletonKpiCard } from '@/components/ui/skeleton';
import { ProPageShell } from '@/components/pro/ProPageShell';
import { fetchJson } from '@/lib/apiClient';
import { useActiveBusiness } from '../../ActiveBusinessProvider';
import { fmtDate } from '@/lib/format';
import { dayKey, startOfWeek, addDays } from '@/lib/date';

// ─── Types ──────────────────────────────────────────────────────────
type MyTask = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  projectId: string | null;
  projectName: string | null;
  progress: number;
  isBlocked: boolean;
  checklistCount?: number;
  checklistDoneCount?: number;
  estimatedMinutes: number | null;
};

type ActiveProject = {
  id: string;
  name: string;
  taskCount: number;
  overdueCount: number;
};

type Summary = {
  overdue: number;
  today: number;
  thisWeek: number;
  inProgress: number;
  blocked: number;
  total: number;
};

type MyTasksData = {
  items: MyTask[];
  summary: Summary;
  activeProjects: ActiveProject[];
};

// ─── Helpers ────────────────────────────────────────────────────────
const EMPTY_SUMMARY: Summary = { overdue: 0, today: 0, thisWeek: 0, inProgress: 0, blocked: 0, total: 0 };

type GroupedTasks = {
  overdue: MyTask[];
  today: MyTask[];
  thisWeek: MyTask[];
  later: MyTask[];
  noDate: MyTask[];
};

function groupByUrgency(items: MyTask[]): GroupedTasks {
  const now = new Date();
  const todayStr = dayKey(now);
  const monday = startOfWeek(now);
  const sundayStr = dayKey(addDays(monday, 6));

  const groups: GroupedTasks = { overdue: [], today: [], thisWeek: [], later: [], noDate: [] };
  for (const t of items) {
    if (!t.dueDate) { groups.noDate.push(t); continue; }
    const dk = t.dueDate.slice(0, 10);
    if (dk < todayStr) groups.overdue.push(t);
    else if (dk === todayStr) groups.today.push(t);
    else if (dk <= sundayStr) groups.thisWeek.push(t);
    else groups.later.push(t);
  }
  return groups;
}

const NEXT_STATUS: Record<string, string> = { TODO: 'IN_PROGRESS', IN_PROGRESS: 'DONE' };

// ─── Inline components ─────────────────────────────────────────────
function UrgencySection({
  title, color, tasks, businessId, onStatusToggle, updatingIds,
}: {
  title: string;
  color: string;
  tasks: MyTask[];
  businessId: string;
  onStatusToggle: (taskId: string, currentStatus: string) => void;
  updatingIds: Record<string, boolean>;
}) {
  if (tasks.length === 0) return null;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</span>
        <span className="text-xs font-medium" style={{ color: 'var(--text-faint)' }}>{tasks.length}</span>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            businessId={businessId}
            onStatusToggle={onStatusToggle}
            updating={!!updatingIds[task.id]}
          />
        ))}
      </div>
    </Card>
  );
}

function TaskRow({
  task, businessId, onStatusToggle, updating,
}: {
  task: MyTask;
  businessId: string;
  onStatusToggle: (taskId: string, currentStatus: string) => void;
  updating: boolean;
}) {
  const hasChecklist = typeof task.checklistCount === 'number' && task.checklistCount > 0;
  const isInProgress = task.status === 'IN_PROGRESS';

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-hover)] transition-colors">
      {/* Status toggle */}
      <button
        type="button"
        disabled={updating || task.status === 'DONE'}
        onClick={() => onStatusToggle(task.id, task.status)}
        className="shrink-0 flex items-center justify-center rounded-full border-2 transition-all"
        style={{
          width: 22, height: 22,
          borderColor: isInProgress ? 'var(--warning)' : 'var(--border)',
          background: isInProgress ? 'var(--warning-bg)' : 'transparent',
          opacity: updating ? 0.5 : 1,
        }}
        title={task.status === 'TODO' ? 'Passer en cours' : 'Terminer'}
      >
        {isInProgress ? (
          <div className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--warning)' }} />
        ) : null}
      </button>

      {/* Task info */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/app/pro/${businessId}/tasks/${task.id}`}
          className="text-sm font-medium hover:underline truncate block"
          style={{ color: 'var(--text)' }}
        >
          {task.title}
        </Link>
        <div className="flex items-center gap-2 mt-0.5">
          {task.projectName && task.projectId ? (
            <Link
              href={`/app/pro/${businessId}/projects/${task.projectId}`}
              className="text-xs hover:underline truncate"
              style={{ color: 'var(--shell-accent)' }}
            >
              {task.projectName}
            </Link>
          ) : null}
          {task.isBlocked ? (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}
            >
              Bloqué
            </span>
          ) : null}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 shrink-0">
        {hasChecklist ? (
          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
            {task.checklistDoneCount}/{task.checklistCount}
          </span>
        ) : null}
        {task.progress > 0 && task.progress < 100 ? (
          <div className="w-12 h-1.5 rounded-full" style={{ background: 'var(--surface-2)' }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${task.progress}%`, background: 'var(--shell-accent)' }}
            />
          </div>
        ) : null}
        {task.dueDate ? (
          <span className="text-xs whitespace-nowrap" style={{ color: 'var(--text-faint)' }}>
            {fmtDate(task.dueDate)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ActiveProjectCard({
  project, businessId,
}: {
  project: ActiveProject;
  businessId: string;
}) {
  return (
    <Link href={`/app/pro/${businessId}/projects/${project.id}`}>
      <Card className="p-3 hover:border-[var(--border-strong)] transition-colors cursor-pointer">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
            {project.name}
          </span>
          <ChevronRight size={14} className="shrink-0" style={{ color: 'var(--text-faint)' }} />
        </div>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
            {project.taskCount} tâche{project.taskCount > 1 ? 's' : ''}
          </span>
          {project.overdueCount > 0 ? (
            <span className="text-xs font-semibold" style={{ color: 'var(--danger)' }}>
              {project.overdueCount} en retard
            </span>
          ) : null}
        </div>
      </Card>
    </Link>
  );
}

// ─── Main page ──────────────────────────────────────────────────────
export default function MyTasksPage() {
  const params = useParams<{ businessId: string }>();
  const businessId = params?.businessId ?? '';
  const activeCtx = useActiveBusiness({ optional: true });
  const actorRole = activeCtx?.activeBusiness?.role ?? null;
  const canCreate = actorRole === 'OWNER' || actorRole === 'ADMIN' || actorRole === 'MEMBER';

  const [data, setData] = useState<MyTasksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingIds, setUpdatingIds] = useState<Record<string, boolean>>({});

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDueDate, setCreateDueDate] = useState('');
  const [creating, setCreating] = useState(false);

  const loadMyTasks = useCallback(async (signal?: AbortSignal) => {
    if (!businessId) return;
    setLoading(true);
    const res = await fetchJson<MyTasksData>(
      `/api/pro/businesses/${businessId}/my-tasks`,
      {},
      signal,
    );
    if (signal?.aborted) return;
    if (res.ok && res.data) setData(res.data);
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadMyTasks(controller.signal);
    return () => controller.abort();
  }, [loadMyTasks]);

  const summary = data?.summary ?? EMPTY_SUMMARY;
  const groups = useMemo(() => groupByUrgency(data?.items ?? []), [data]);

  const handleStatusToggle = useCallback(async (taskId: string, currentStatus: string) => {
    const nextStatus = NEXT_STATUS[currentStatus];
    if (!nextStatus) return;
    setUpdatingIds((prev) => ({ ...prev, [taskId]: true }));
    try {
      const res = await fetchJson(`/api/pro/businesses/${businessId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) await loadMyTasks();
    } finally {
      setUpdatingIds((prev) => ({ ...prev, [taskId]: false }));
    }
  }, [businessId, loadMyTasks]);

  const handleCreate = useCallback(async () => {
    const title = createTitle.trim();
    if (!title || title.length > 200) return;
    setCreating(true);
    const payload: Record<string, unknown> = { title, status: 'TODO' };
    if (createDueDate) payload.dueDate = new Date(createDueDate).toISOString();
    const res = await fetchJson(`/api/pro/businesses/${businessId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setCreating(false);
    if (res.ok) {
      setCreateOpen(false);
      setCreateTitle('');
      setCreateDueDate('');
      await loadMyTasks();
    }
  }, [businessId, createTitle, createDueDate, loadMyTasks]);

  const hasNoTasks = !loading && (data?.items.length ?? 0) === 0;

  return (
    <ProPageShell
      backHref={`/app/pro/${businessId}`}
      backLabel="Dashboard"
      title="Mes Tâches"
      subtitle="Organisez et dirigez votre journée"
      actions={
        canCreate ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} className="mr-1" />
            Nouvelle tâche
          </Button>
        ) : undefined
      }
    >
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {loading ? (
          <>
            <SkeletonKpiCard />
            <SkeletonKpiCard />
            <SkeletonKpiCard />
            <SkeletonKpiCard />
          </>
        ) : (
          <>
            <KpiCard
              label="En retard"
              value={summary.overdue}
              delay={0}
              size="compact"
              className={summary.overdue > 0 ? 'outline-[var(--danger)]' : undefined}
            />
            <KpiCard label="Aujourd'hui" value={summary.today} delay={50} size="compact" />
            <KpiCard label="Cette semaine" value={summary.thisWeek} delay={100} size="compact" />
            <KpiCard label="En cours" value={summary.inProgress} delay={150} size="compact" />
          </>
        )}
      </div>

      {/* Empty state */}
      {hasNoTasks ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ClipboardList size={48} style={{ color: 'var(--text-faint)' }} />
          <p className="mt-4 text-lg font-semibold" style={{ color: 'var(--text)' }}>
            Aucune tâche assignée
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-faint)' }}>
            Les tâches qui vous sont assignées apparaîtront ici.
          </p>
        </div>
      ) : null}

      {/* Content grid */}
      {!hasNoTasks ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
          {/* Main: urgency sections */}
          <div className="space-y-4">
            {loading ? (
              <Card className="p-4 space-y-3">
                <Skeleton width="40%" height="14px" />
                <Skeleton height="48px" />
                <Skeleton height="48px" />
                <Skeleton height="48px" />
              </Card>
            ) : (
              <>
                <UrgencySection
                  title="En retard" color="var(--danger)"
                  tasks={groups.overdue} businessId={businessId}
                  onStatusToggle={handleStatusToggle} updatingIds={updatingIds}
                />
                <UrgencySection
                  title="Aujourd'hui" color="var(--warning)"
                  tasks={groups.today} businessId={businessId}
                  onStatusToggle={handleStatusToggle} updatingIds={updatingIds}
                />
                <UrgencySection
                  title="Cette semaine" color="var(--info)"
                  tasks={groups.thisWeek} businessId={businessId}
                  onStatusToggle={handleStatusToggle} updatingIds={updatingIds}
                />
                <UrgencySection
                  title="Plus tard" color="var(--text-faint)"
                  tasks={groups.later} businessId={businessId}
                  onStatusToggle={handleStatusToggle} updatingIds={updatingIds}
                />
                <UrgencySection
                  title="Sans date" color="var(--text-faint)"
                  tasks={groups.noDate} businessId={businessId}
                  onStatusToggle={handleStatusToggle} updatingIds={updatingIds}
                />
              </>
            )}
          </div>

          {/* Sidebar: active projects */}
          <aside className="space-y-3">
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              Projets actifs
            </span>
            {loading ? (
              <>
                <Skeleton height="64px" />
                <Skeleton height="64px" />
              </>
            ) : (data?.activeProjects ?? []).length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                Aucun projet lié à vos tâches.
              </p>
            ) : (
              (data?.activeProjects ?? []).map((p) => (
                <ActiveProjectCard key={p.id} project={p} businessId={businessId} />
              ))
            )}
          </aside>
        </div>
      ) : null}

      {/* Create modal */}
      <Modal
        open={createOpen}
        onCloseAction={() => { if (!creating) setCreateOpen(false); }}
        title="Nouvelle tâche"
        description="Créez une tâche qui vous sera assignée."
      >
        <form
          onSubmit={(e) => { e.preventDefault(); void handleCreate(); }}
          className="space-y-3"
        >
          <Input
            label="Titre"
            value={createTitle}
            onChange={(e) => setCreateTitle(e.target.value)}
            maxLength={200}
            autoFocus
          />
          <Input
            label="Échéance (optionnel)"
            type="date"
            value={createDueDate}
            onChange={(e) => setCreateDueDate(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" type="button" onClick={() => setCreateOpen(false)} disabled={creating}>
              Annuler
            </Button>
            <Button type="submit" disabled={creating || !createTitle.trim()}>
              {creating ? 'Création…' : 'Créer'}
            </Button>
          </div>
        </form>
      </Modal>
    </ProPageShell>
  );
}
