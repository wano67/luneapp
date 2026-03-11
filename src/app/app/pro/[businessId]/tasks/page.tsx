'use client';

import Link from 'next/link';
import { useEffect, useMemo, useCallback, useState } from 'react';
import { useParams } from 'next/navigation';
import { ListChecks, ChevronRight, Plus, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { KpiCard } from '@/components/ui/kpi-card';
import { Skeleton, SkeletonKpiCard } from '@/components/ui/skeleton';
import { ProPageShell } from '@/components/pro/ProPageShell';
import { fetchJson } from '@/lib/apiClient';
import { useActiveBusiness } from '../../ActiveBusinessProvider';
import { fmtDate } from '@/lib/format';
import { dayKey, startOfWeek, addDays } from '@/lib/date';
import { revalidate, useRevalidationKey } from '@/lib/revalidate';

// ─── Types ──────────────────────────────────────────────────────────
type MyTask = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  projectId: string | null;
  projectName: string | null;
  assigneeUserId: string | null;
  assigneeName: string | null;
  progress: number;
  isBlocked: boolean;
  checklistCount?: number;
  checklistDoneCount?: number;
  estimatedMinutes: number | null;
  completedAt: string | null;
};

type ActiveProject = { id: string; name: string; taskCount: number; overdueCount: number };
type Summary = { overdue: number; today: number; thisWeek: number; blocked: number; total: number };
type MyTasksData = { items: MyTask[]; summary: Summary; activeProjects: ActiveProject[] };
type Member = { userId: string; name: string | null; email: string; role: string };
type ProjectOption = { id: string; name: string };

type WeeklyStats = {
  completedThisWeek: number;
  pendingThisWeek: number;
  totalThisWeek: number;
  percentComplete: number;
  completedByDay: Record<string, number>;
  userName: string | null;
  userId: string;
};

// ─── Helpers ────────────────────────────────────────────────────────
const EMPTY_SUMMARY: Summary = { overdue: 0, today: 0, thisWeek: 0, blocked: 0, total: 0 };

type GroupedTasks = { overdue: MyTask[]; today: MyTask[]; thisWeek: MyTask[]; later: MyTask[]; noDate: MyTask[]; done: MyTask[] };

function groupByUrgency(items: MyTask[]): GroupedTasks {
  const now = new Date();
  const todayStr = dayKey(now);
  const monday = startOfWeek(now);
  const sundayStr = dayKey(addDays(monday, 6));

  const groups: GroupedTasks = { overdue: [], today: [], thisWeek: [], later: [], noDate: [], done: [] };
  for (const t of items) {
    if (t.status === 'DONE') { groups.done.push(t); continue; }
    if (!t.dueDate) { groups.noDate.push(t); continue; }
    const dk = t.dueDate.slice(0, 10);
    if (dk < todayStr) groups.overdue.push(t);
    else if (dk === todayStr) groups.today.push(t);
    else if (dk <= sundayStr) groups.thisWeek.push(t);
    else groups.later.push(t);
  }
  return groups;
}

// ─── Inline components ─────────────────────────────────────────────
function UrgencySection({
  title, color, tasks, businessId, onStatusChange, updatingIds,
}: {
  title: string;
  color: string;
  tasks: MyTask[];
  businessId: string;
  onStatusChange: (taskId: string, newStatus: string) => void;
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
            onStatusChange={onStatusChange}
            updating={!!updatingIds[task.id]}
          />
        ))}
      </div>
    </Card>
  );
}

function TaskRow({
  task, businessId, onStatusChange, updating,
}: {
  task: MyTask;
  businessId: string;
  onStatusChange: (taskId: string, newStatus: string) => void;
  updating: boolean;
}) {
  const hasChecklist = typeof task.checklistCount === 'number' && task.checklistCount > 0;
  const isDone = task.status === 'DONE';

  return (
    <div className={`flex items-center gap-3 px-4 py-3 transition-colors ${isDone ? 'opacity-60' : 'hover:bg-[var(--surface-hover)]'}`}>
      {/* One-click validate / revert */}
      <button
        type="button"
        disabled={updating}
        onClick={() => onStatusChange(task.id, isDone ? 'TODO' : 'DONE')}
        className="shrink-0 flex items-center justify-center rounded-full border-2 transition-all"
        style={{
          width: 22, height: 22,
          borderColor: isDone ? 'var(--success)' : 'var(--border)',
          background: isDone ? 'var(--success)' : 'transparent',
          opacity: updating ? 0.5 : 1,
        }}
        title={isDone ? 'Remettre à faire' : 'Valider'}
      >
        {isDone ? <Check size={13} color="white" strokeWidth={3} /> : null}
      </button>

      {/* Task info */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/app/pro/${businessId}/tasks/${task.id}`}
          className={`text-sm font-medium hover:underline truncate block ${isDone ? 'line-through' : ''}`}
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
          {task.isBlocked && !isDone ? (
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
        {hasChecklist && !isDone ? (
          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
            {task.checklistDoneCount}/{task.checklistCount}
          </span>
        ) : null}
        {task.progress > 0 && task.progress < 100 && !isDone ? (
          <div className="w-12 h-1.5 rounded-full" style={{ background: 'var(--surface-2)' }}>
            <div className="h-full rounded-full" style={{ width: `${task.progress}%`, background: 'var(--shell-accent)' }} />
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

function DoneSection({
  tasks, businessId, onStatusChange, updatingIds,
}: {
  tasks: MyTask[];
  businessId: string;
  onStatusChange: (taskId: string, newStatus: string) => void;
  updatingIds: Record<string, boolean>;
}) {
  const [expanded, setExpanded] = useState(false);
  if (tasks.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex items-center gap-2.5 px-4 py-3 w-full text-left hover:bg-[var(--surface-hover)] transition-colors"
        style={{ borderBottom: expanded ? '1px solid var(--border)' : undefined }}
      >
        <div className="h-2 w-2 rounded-full shrink-0" style={{ background: 'var(--success)' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Terminées</span>
        <span className="text-xs font-medium" style={{ color: 'var(--text-faint)' }}>{tasks.length}</span>
        <span className="ml-auto">
          {expanded ? <ChevronUp size={14} style={{ color: 'var(--text-faint)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-faint)' }} />}
        </span>
      </button>
      {expanded ? (
        <div className="divide-y divide-[var(--border)]">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              businessId={businessId}
              onStatusChange={onStatusChange}
              updating={!!updatingIds[task.id]}
            />
          ))}
        </div>
      ) : null}
    </Card>
  );
}

function ActiveProjectCard({ project, businessId }: { project: ActiveProject; businessId: string }) {
  return (
    <Link href={`/app/pro/${businessId}/projects/${project.id}`}>
      <Card className="p-3 hover:border-[var(--border-strong)] transition-colors cursor-pointer">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{project.name}</span>
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

// ─── Weekly progress card ────────────────────────────────────────────
function WeeklyProgressCard({ stats, loading: isLoading }: { stats: WeeklyStats | null; loading: boolean }) {
  if (isLoading) return <Skeleton height="120px" />;
  if (!stats) return null;

  const { completedThisWeek, pendingThisWeek, totalThisWeek, percentComplete, completedByDay } = stats;

  const r = 38;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (percentComplete / 100) * circumference;
  const ringColor = totalThisWeek === 0
    ? 'var(--text-faint)'
    : percentComplete >= 80
      ? 'var(--success)'
      : percentComplete >= 50
        ? 'var(--warning)'
        : 'var(--danger)';

  const days = Object.entries(completedByDay);
  const maxDay = Math.max(...days.map(([, v]) => v), 1);
  const dayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  return (
    <Card className="p-4">
      <div className="flex items-center gap-6">
        <div className="relative shrink-0" style={{ width: 88, height: 88 }}>
          <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90">
            <circle cx="44" cy="44" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="6" />
            <circle
              cx="44" cy="44" r={r} fill="none" stroke={ringColor} strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold" style={{ color: 'var(--text)' }}>{percentComplete}%</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            {completedThisWeek} tâche{completedThisWeek !== 1 ? 's' : ''} accomplie{completedThisWeek !== 1 ? 's' : ''} cette semaine
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
            {pendingThisWeek} restante{pendingThisWeek !== 1 ? 's' : ''} · {totalThisWeek} total
          </p>

          <div className="flex items-end gap-1.5 mt-3">
            {days.map(([date, count], i) => (
              <div key={date} className="flex flex-col items-center gap-0.5 flex-1">
                <div
                  className="w-full rounded-sm transition-all"
                  style={{
                    height: count > 0 ? `${Math.max((count / maxDay) * 20, 3)}px` : '2px',
                    background: count > 0 ? ringColor : 'var(--surface-2)',
                  }}
                />
                <span className="text-[9px]" style={{ color: 'var(--text-faint)' }}>{dayLabels[i]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Main page ──────────────────────────────────────────────────────
export default function MyTasksPage() {
  const params = useParams<{ businessId: string }>();
  const businessId = params?.businessId ?? '';
  const activeCtx = useActiveBusiness({ optional: true });
  const actorRole = activeCtx?.activeBusiness?.role ?? null;
  const isAdmin = actorRole === 'OWNER' || actorRole === 'ADMIN';
  const canCreate = isAdmin || actorRole === 'MEMBER';

  const [data, setData] = useState<MyTasksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingIds, setUpdatingIds] = useState<Record<string, boolean>>({});
  const [fetchVersion, setFetchVersion] = useState(0);
  const tasksRv = useRevalidationKey(['pro:tasks']);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(true);

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDueDate, setCreateDueDate] = useState('');
  const [createProjectId, setCreateProjectId] = useState('');
  const [createAssigneeId, setCreateAssigneeId] = useState('');
  const [creating, setCreating] = useState(false);

  // Dropdown data for modal
  const [members, setMembers] = useState<Member[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  // Load members + projects for modal (admin/owner only loads members)
  useEffect(() => {
    if (!businessId) return;
    const controller = new AbortController();

    fetchJson<{ items: ProjectOption[] }>(
      `/api/pro/businesses/${businessId}/projects?scope=ACTIVE`,
      {},
      controller.signal,
    ).then((res) => {
      if (res.ok && res.data) setProjects(res.data.items);
    });

    if (isAdmin) {
      fetchJson<{ items: Member[] }>(
        `/api/pro/businesses/${businessId}/members`,
        {},
        controller.signal,
      ).then((res) => {
        if (res.ok && res.data) setMembers(res.data.items);
      });
    }

    return () => controller.abort();
  }, [businessId, isAdmin]);

  // Load tasks
  useEffect(() => {
    if (!businessId) return;
    const controller = new AbortController();
    setLoading(true);
    const tasksUrl = selectedMemberId
      ? `/api/pro/businesses/${businessId}/my-tasks?includeDone=true&userId=${selectedMemberId}`
      : `/api/pro/businesses/${businessId}/my-tasks?includeDone=true`;
    fetchJson<MyTasksData>(
      tasksUrl,
      {},
      controller.signal,
    ).then(res => {
      if (controller.signal.aborted) return;
      if (res.ok && res.data) setData(res.data);
      setLoading(false);
    });
    return () => controller.abort();
  }, [businessId, selectedMemberId, fetchVersion, tasksRv]);

  // Load weekly stats
  useEffect(() => {
    if (!businessId) return;
    const controller = new AbortController();
    setWeeklyLoading(true);
    const url = selectedMemberId
      ? `/api/pro/businesses/${businessId}/tasks/weekly-stats?userId=${selectedMemberId}`
      : `/api/pro/businesses/${businessId}/tasks/weekly-stats`;
    fetchJson<WeeklyStats>(url, {}, controller.signal).then(res => {
      if (controller.signal.aborted) return;
      if (res.ok && res.data) setWeeklyStats(res.data);
      setWeeklyLoading(false);
    });
    return () => controller.abort();
  }, [businessId, selectedMemberId, fetchVersion, tasksRv]);

  const summary = data?.summary ?? EMPTY_SUMMARY;
  const groups = useMemo(() => groupByUrgency(data?.items ?? []), [data]);

  const handleStatusChange = useCallback(async (taskId: string, newStatus: string) => {
    setUpdatingIds((prev) => ({ ...prev, [taskId]: true }));
    try {
      const res = await fetchJson(`/api/pro/businesses/${businessId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setFetchVersion(v => v + 1);
        revalidate('pro:tasks');
      }
    } finally {
      setUpdatingIds((prev) => ({ ...prev, [taskId]: false }));
    }
  }, [businessId]);

  const handleCreate = useCallback(async () => {
    const title = createTitle.trim();
    if (!title || title.length > 200) return;
    setCreating(true);
    const payload: Record<string, unknown> = { title, status: 'TODO', assignToSelf: true };
    if (createDueDate) payload.dueDate = new Date(createDueDate).toISOString();
    if (createProjectId) payload.projectId = createProjectId;
    if (createAssigneeId && isAdmin) payload.assigneeUserId = createAssigneeId;
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
      setCreateProjectId('');
      setCreateAssigneeId('');
      setFetchVersion(v => v + 1);
      revalidate('pro:tasks');
    }
  }, [businessId, createTitle, createDueDate, createProjectId, createAssigneeId, isAdmin]);

  const openCreateModal = useCallback(() => {
    setCreateTitle('');
    setCreateDueDate('');
    setCreateProjectId('');
    setCreateAssigneeId('');
    setCreateOpen(true);
  }, []);

  // Current user's ID (from the initial weekly-stats call without userId param)
  const [myUserId, setMyUserId] = useState('');

  // Capture own userId on first weekly-stats load (no member selected)
  useEffect(() => {
    if (!selectedMemberId && weeklyStats?.userId) {
      setMyUserId(weeklyStats.userId);
    }
  }, [selectedMemberId, weeklyStats]);

  // Filter self out of the member dropdown
  const otherMembers = useMemo(
    () => (myUserId ? members.filter((m) => m.userId !== myUserId) : members),
    [members, myUserId],
  );

  const hasNoTasks = !loading && (data?.items.length ?? 0) === 0;

  return (
    <ProPageShell
      backHref={`/app/pro/${businessId}`}
      backLabel="Dashboard"
      title={weeklyStats?.userName ? `Tâches de ${weeklyStats.userName}` : 'Mes Tâches'}
      subtitle="Organisez et dirigez votre journée"
      actions={
        <div className="flex items-center gap-2">
          {isAdmin && otherMembers.length > 0 ? (
            <Select
              className="w-44"
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
            >
              <option value="">Moi-même</option>
              {otherMembers.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name ?? m.email}
                </option>
              ))}
            </Select>
          ) : null}
          {canCreate ? (
            <Button onClick={openCreateModal} className="whitespace-nowrap">
              <Plus size={16} className="mr-1 shrink-0" />
              Nouvelle tâche
            </Button>
          ) : null}
        </div>
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
            <KpiCard label="Bloquées" value={summary.blocked} delay={150} size="compact" />
          </>
        )}
      </div>

      {/* Weekly progress */}
      <WeeklyProgressCard stats={weeklyStats} loading={weeklyLoading} />

      {/* Empty state */}
      {hasNoTasks ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ListChecks size={48} style={{ color: 'var(--text-faint)' }} />
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
                  onStatusChange={handleStatusChange} updatingIds={updatingIds}
                />
                <UrgencySection
                  title="Aujourd'hui" color="var(--warning)"
                  tasks={groups.today} businessId={businessId}
                  onStatusChange={handleStatusChange} updatingIds={updatingIds}
                />
                <UrgencySection
                  title="Cette semaine" color="var(--info)"
                  tasks={groups.thisWeek} businessId={businessId}
                  onStatusChange={handleStatusChange} updatingIds={updatingIds}
                />
                <UrgencySection
                  title="Plus tard" color="var(--text-faint)"
                  tasks={groups.later} businessId={businessId}
                  onStatusChange={handleStatusChange} updatingIds={updatingIds}
                />
                <UrgencySection
                  title="Sans date" color="var(--text-faint)"
                  tasks={groups.noDate} businessId={businessId}
                  onStatusChange={handleStatusChange} updatingIds={updatingIds}
                />
                <DoneSection
                  tasks={groups.done} businessId={businessId}
                  onStatusChange={handleStatusChange} updatingIds={updatingIds}
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
        description="Définissez le titre, le projet, l'échéance et l'assignation."
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
            placeholder="Ex : Finaliser la maquette…"
          />

          <Select
            label="Projet"
            value={createProjectId}
            onChange={(e) => setCreateProjectId(e.target.value)}
          >
            <option value="">Aucun projet</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>

          <Input
            label="Échéance"
            type="date"
            value={createDueDate}
            onChange={(e) => setCreateDueDate(e.target.value)}
          />

          {isAdmin ? (
            <Select
              label="Assigner à"
              value={createAssigneeId}
              onChange={(e) => setCreateAssigneeId(e.target.value)}
            >
              <option value="">Moi-même</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name ?? m.email} ({m.role === 'OWNER' ? 'Owner' : m.role === 'ADMIN' ? 'Admin' : 'Membre'})
                </option>
              ))}
            </Select>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" type="button" onClick={() => setCreateOpen(false)} disabled={creating}>
              Annuler
            </Button>
            <Button type="submit" disabled={creating || !createTitle.trim()}>
              {creating ? 'Création…' : 'Créer la tâche'}
            </Button>
          </div>
        </form>
      </Modal>
    </ProPageShell>
  );
}
