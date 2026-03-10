// src/app/app/pro/[businessId]/tasks/[taskId]/page.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { fetchJson } from '@/lib/apiClient';
import { useActiveBusiness } from '../../../ActiveBusinessProvider';
import { ProPageShell } from '@/components/pro/ProPageShell';
import { Check, Trash2, Plus, X, Calendar, User, FolderOpen, HelpCircle, AlertTriangle, Users } from 'lucide-react';
import { TASK_STATUS_OPTIONS, getTaskStatusBadgeClasses } from '@/lib/taskStatusUi';
import { fmtDate } from '@/lib/format';

type Task = {
  id: string;
  businessId: string;
  projectId: string | null;
  projectName: string | null;
  parentTaskId: string | null;
  assigneeUserId: string | null;
  assigneeEmail: string | null;
  assigneeName: string | null;
  title: string;
  status: string;
  dueDate: string | null;
  notes: string | null;
  progress: number;
  isBlocked: boolean;
  blockedReason: string | null;
  createdAt: string;
  updatedAt: string;
};

type ChecklistItem = {
  id: string;
  title: string;
  position: number;
  isCompleted: boolean;
  completedAt: string | null;
  completedBy: { id: string; name: string | null; email: string | null } | null;
  createdAt: string;
  updatedAt: string;
};

type TaskDetailResponse = { item: Task };
type ChecklistResponse = { items: ChecklistItem[] };
type TeamMember = {
  userId: string;
  membershipId: string;
  name: string | null;
  email: string;
  role: string;
  organizationUnit: { id: string; name: string } | null;
};
type ProjectOption = { id: string; name: string };
type ProjectMember = {
  userId: string;
  name: string | null;
  email: string;
  implicit: boolean;
};

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const businessId = (params?.businessId ?? '') as string;
  const taskId = (params?.taskId ?? '') as string;
  const activeCtx = useActiveBusiness({ optional: true });
  const role = activeCtx?.activeBusiness?.role;
  const isAdmin = role === 'ADMIN' || role === 'OWNER';
  const [myUserId, setMyUserId] = useState('');
  const canChangeStatus = role === 'ADMIN' || role === 'OWNER' || role === 'MEMBER';

  const [task, setTask] = useState<Task | null>(null);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit states
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Checklist
  const [checklistTitle, setChecklistTitle] = useState('');
  const [checklistSaving, setChecklistSaving] = useState(false);

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Help request
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpMessage, setHelpMessage] = useState('');
  const [helpRecipient, setHelpRecipient] = useState('');
  const [helpIsProjectGroup, setHelpIsProjectGroup] = useState(false);
  const [helpSending, setHelpSending] = useState(false);

  // Dropdown data
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  // ─── Load task ──────────────────────────────────────────────────────
  const loadChecklist = useCallback(
    async (signal?: AbortSignal) => {
      const res = await fetchJson<ChecklistResponse>(
        `/api/pro/businesses/${businessId}/tasks/${taskId}/checklist`,
        {},
        signal,
      );
      if (res.ok && res.data) setChecklistItems(res.data.items ?? []);
    },
    [businessId, taskId],
  );

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchJson<TaskDetailResponse>(
          `/api/pro/businesses/${businessId}/tasks/${taskId}`,
          {},
          controller.signal,
        );
        if (controller.signal.aborted) return;
        if (res.status === 401) {
          window.location.href = `/login?from=${encodeURIComponent(window.location.pathname)}`;
          return;
        }
        if (!res.ok || !res.data) {
          setError(res.error ?? 'Tache introuvable.');
          setTask(null);
          return;
        }
        setTask(res.data.item);
        void loadChecklist(controller.signal);
      } catch {
        if (!controller.signal.aborted) setError('Impossible de charger la tache.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [businessId, taskId, loadChecklist]);

  // Load current user ID
  useEffect(() => {
    fetchJson<{ user: { id: string } }>('/api/auth/me').then((res) => {
      if (res.ok && res.data?.user?.id) setMyUserId(String(res.data.user.id));
    });
  }, []);

  // Load team members (for everyone — needed for help request)
  useEffect(() => {
    if (!businessId) return;
    const controller = new AbortController();
    fetchJson<{ items: TeamMember[] }>(
      `/api/pro/businesses/${businessId}/members`,
      {},
      controller.signal,
    ).then((res) => {
      if (res.ok && res.data) setTeamMembers(res.data.items);
    });
    return () => controller.abort();
  }, [businessId]);

  // Load projects (admin only)
  useEffect(() => {
    if (!businessId || !isAdmin) return;
    const controller = new AbortController();
    fetchJson<{ items: ProjectOption[] }>(
      `/api/pro/businesses/${businessId}/projects?scope=ACTIVE`,
      {},
      controller.signal,
    ).then((res) => {
      if (res.ok && res.data) setProjects(res.data.items);
    });
    return () => controller.abort();
  }, [businessId, isAdmin]);

  // Load project members when task has a project
  useEffect(() => {
    if (!businessId || !task?.projectId) return;
    const controller = new AbortController();
    fetchJson<{ items: ProjectMember[] }>(
      `/api/pro/businesses/${businessId}/projects/${task.projectId}/members`,
      {},
      controller.signal,
    ).then((res) => {
      if (res.ok && res.data) setProjectMembers(res.data.items);
    });
    return () => controller.abort();
  }, [businessId, task?.projectId]);

  // ─── PATCH helper ──────────────────────────────────────────────────
  const patchTask = useCallback(
    async (payload: Record<string, unknown>) => {
      setSaving(true);
      const res = await fetchJson<TaskDetailResponse>(
        `/api/pro/businesses/${businessId}/tasks/${taskId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      if (res.ok && res.data) setTask(res.data.item);
      setSaving(false);
      return res.ok;
    },
    [businessId, taskId],
  );

  // ─── Handlers ──────────────────────────────────────────────────────
  function startEditTitle() {
    if (!isAdmin || !task) return;
    setTitleDraft(task.title);
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 0);
  }

  async function saveTitle() {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === task?.title) {
      setEditingTitle(false);
      return;
    }
    await patchTask({ title: trimmed });
    setEditingTitle(false);
  }

  async function handleStatusChange(newStatus: string) {
    if (!canChangeStatus) return;
    await patchTask({ status: newStatus });
  }

  async function handleDueDateChange(value: string) {
    if (!isAdmin) return;
    await patchTask({ dueDate: value ? new Date(value).toISOString() : null });
  }

  async function handleAssigneeChange(userId: string) {
    if (!isAdmin) return;
    await patchTask({ assigneeUserId: userId || null });
  }

  async function handleProjectChange(projectId: string) {
    if (!isAdmin) return;
    await patchTask({ projectId: projectId || null });
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await fetchJson(
      `/api/pro/businesses/${businessId}/tasks/${taskId}`,
      { method: 'DELETE' },
    );
    setDeleting(false);
    if (res.ok) {
      router.push(`/app/pro/${businessId}/tasks`);
    }
  }

  async function handleUnblock() {
    await patchTask({ isBlocked: false, blockedReason: null });
  }

  // ─── Help request ──────────────────────────────────────────────────
  async function handleSendHelp() {
    if ((!helpRecipient && !helpIsProjectGroup) || helpSending) return;
    setHelpSending(true);

    // 1. Mark task as blocked
    await patchTask({ isBlocked: true, blockedReason: helpMessage.trim() || 'Demande d\'aide envoyee' });

    const messageContent = helpMessage.trim()
      ? `Besoin d'aide sur la tache "${task?.title}" :\n${helpMessage.trim()}`
      : `Besoin d'aide sur la tache "${task?.title}"`;

    let conversationId: string | null = null;

    if (helpIsProjectGroup && task?.projectId) {
      // 2a. Find or create a GROUP conversation on the project
      const listRes = await fetchJson<{ items: { id: string; type: string; name: string | null }[] }>(
        `/api/pro/businesses/${businessId}/projects/${task.projectId}/conversations`,
      );
      const existing = listRes.ok && listRes.data
        ? listRes.data.items.find((c) => c.type === 'GROUP')
        : null;

      if (existing) {
        conversationId = existing.id;
      } else {
        // Create group with all project members
        const memberIds = projectMembers
          .filter((m) => m.userId !== myUserId)
          .map((m) => m.userId);
        if (memberIds.length > 0) {
          const createRes = await fetchJson<{ item: { id: string } }>(
            `/api/pro/businesses/${businessId}/projects/${task.projectId}/conversations`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'GROUP',
                name: task.projectName ?? 'Projet',
                memberUserIds: memberIds,
              }),
            },
          );
          if (createRes.ok && createRes.data) conversationId = createRes.data.item.id;
        }
      }
    } else if (helpRecipient) {
      // 2b. Create or find private conversation
      const convRes = await fetchJson<{ item: { id: string } }>(
        `/api/pro/businesses/${businessId}/conversations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'PRIVATE',
            memberUserIds: [helpRecipient],
          }),
        },
      );
      if (convRes.ok && convRes.data) conversationId = convRes.data.item.id;
    }

    // 3. Send message with task reference
    if (conversationId) {
      await fetchJson(
        `/api/pro/businesses/${businessId}/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: messageContent,
            taskId,
          }),
        },
      );
    }

    setHelpSending(false);
    setHelpOpen(false);
    setHelpMessage('');
    setHelpRecipient('');
    setHelpIsProjectGroup(false);
  }

  // ─── Checklist handlers ────────────────────────────────────────────
  async function handleAddChecklistItem() {
    if (!isAdmin || checklistSaving) return;
    const title = checklistTitle.trim();
    if (!title) return;
    setChecklistSaving(true);
    const res = await fetchJson<{ item: ChecklistItem }>(
      `/api/pro/businesses/${businessId}/tasks/${taskId}/checklist`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      },
    );
    if (res.ok) {
      setChecklistTitle('');
      await loadChecklist();
    }
    setChecklistSaving(false);
  }

  async function handleToggleChecklistItem(item: ChecklistItem, nextValue: boolean) {
    if (!isAdmin) return;
    await fetchJson(
      `/api/pro/businesses/${businessId}/tasks/${taskId}/checklist/${item.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: nextValue }),
      },
    );
    await loadChecklist();
  }

  async function handleDeleteChecklistItem(itemId: string) {
    if (!isAdmin) return;
    await fetchJson(
      `/api/pro/businesses/${businessId}/tasks/${taskId}/checklist/${itemId}`,
      { method: 'DELETE' },
    );
    await loadChecklist();
  }

  // ─── Help modal: group members ─────────────────────────────────────
  function getHelpRecipients() {
    const otherMembers = teamMembers.filter((m) => m.userId !== myUserId);
    const projectMemberIds = new Set(projectMembers.filter((m) => m.userId !== myUserId).map((m) => m.userId));

    // Group by: project members, then by pole, then ungrouped
    const inProject: TeamMember[] = [];
    const byPole: Record<string, TeamMember[]> = {};
    const other: TeamMember[] = [];

    for (const m of otherMembers) {
      if (task?.projectId && projectMemberIds.has(m.userId)) {
        inProject.push(m);
      } else if (m.organizationUnit) {
        const poleName = m.organizationUnit.name;
        if (!byPole[poleName]) byPole[poleName] = [];
        byPole[poleName].push(m);
      } else {
        other.push(m);
      }
    }

    return { inProject, byPole, other };
  }

  // ─── Loading / error states ────────────────────────────────────────
  if (loading) {
    return (
      <ProPageShell
        backHref={`/app/pro/${businessId}/tasks`}
        backLabel="Taches"
        title="Chargement..."
      >
        <Card className="p-6">
          <p className="text-sm" style={{ color: 'var(--text-faint)' }}>Chargement de la tache...</p>
        </Card>
      </ProPageShell>
    );
  }

  if (!task) {
    return (
      <ProPageShell
        backHref={`/app/pro/${businessId}/tasks`}
        backLabel="Taches"
        title="Tache introuvable"
      >
        <Card className="p-6 space-y-3">
          <p className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>{error ?? 'Tache introuvable.'}</p>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/app/pro/${businessId}/tasks`}>Retour a la liste</Link>
          </Button>
        </Card>
      </ProPageShell>
    );
  }

  const isDone = task.status === 'DONE';
  const checklistSorted = [...checklistItems].sort((a, b) => a.position - b.position);
  const checklistDone = checklistItems.filter((i) => i.isCompleted).length;
  const checklistTotal = checklistItems.length;
  const dueDateValue = task.dueDate ? task.dueDate.slice(0, 10) : '';
  const { inProject, byPole, other } = getHelpRecipients();

  return (
    <ProPageShell
      backHref={`/app/pro/${businessId}/tasks`}
      backLabel="Taches"
      title="Detail de la tache"
    >
      {/* ── Title + Status hero ── */}
      <Card className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          {/* Status toggle button */}
          <button
            type="button"
            disabled={saving || !canChangeStatus}
            onClick={() => void handleStatusChange(isDone ? 'TODO' : 'DONE')}
            className="shrink-0 flex items-center justify-center rounded-full border-2 transition-all mt-1"
            style={{
              width: 28,
              height: 28,
              borderColor: isDone ? 'var(--success)' : 'var(--border)',
              background: isDone ? 'var(--success)' : 'transparent',
              opacity: saving ? 0.5 : 1,
            }}
            title={isDone ? 'Remettre a faire' : 'Marquer comme terminee'}
          >
            {isDone ? <Check size={16} color="white" strokeWidth={3} /> : null}
          </button>

          {/* Title — click to edit (admin only) */}
          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <input
                ref={titleInputRef}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => void saveTitle()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void saveTitle();
                  if (e.key === 'Escape') setEditingTitle(false);
                }}
                className="w-full bg-transparent outline-none border-b-2 border-[var(--shell-accent)] pb-1"
                style={{ color: 'var(--text)', fontSize: 22, fontWeight: 700 }}
                maxLength={200}
              />
            ) : (
              <h1
                onClick={isAdmin ? startEditTitle : undefined}
                className={`${isDone ? 'line-through opacity-60' : ''} ${isAdmin ? 'cursor-pointer hover:opacity-80' : ''}`}
                style={{ color: 'var(--text)', fontSize: 22, fontWeight: 700, lineHeight: 1.3 }}
              >
                {task.title}
              </h1>
            )}
            <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
              Creee le {fmtDate(task.createdAt)}
              {task.updatedAt !== task.createdAt ? ` · Modifiee le ${fmtDate(task.updatedAt)}` : ''}
            </p>
          </div>
        </div>

        {/* Status pills + help button */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {TASK_STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={saving || !canChangeStatus}
                onClick={() => void handleStatusChange(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${getTaskStatusBadgeClasses(opt.value)}`}
                style={{
                  opacity: task.status === opt.value ? 1 : 0.5,
                  transform: task.status === opt.value ? 'scale(1.05)' : 'scale(1)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {!isDone && canChangeStatus ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHelpOpen(true)}
              className="whitespace-nowrap"
            >
              <HelpCircle size={14} className="mr-1.5" />
              Demander de l&apos;aide
            </Button>
          ) : null}
        </div>

        {/* Blocked banner */}
        {task.isBlocked ? (
          <div
            className="flex items-center gap-3 rounded-lg px-4 py-3"
            style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderColor: 'color-mix(in srgb, var(--danger) 30%, transparent)' }}
          >
            <AlertTriangle size={16} style={{ color: 'var(--danger)' }} className="shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>Tache bloquee</p>
              {task.blockedReason ? (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>{task.blockedReason}</p>
              ) : null}
            </div>
            {canChangeStatus ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleUnblock()}
                disabled={saving}
                className="shrink-0"
              >
                Debloquer
              </Button>
            ) : null}
          </div>
        ) : null}
      </Card>

      {/* ── Details grid ── */}
      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Due date */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-faint)' }}>
              <Calendar size={13} />
              Echeance
            </label>
            {isAdmin ? (
              <Input
                type="date"
                value={dueDateValue}
                onChange={(e) => void handleDueDateChange(e.target.value)}
                disabled={saving}
              />
            ) : (
              <p className="text-sm" style={{ color: 'var(--text)' }}>
                {task.dueDate ? fmtDate(task.dueDate) : 'Non definie'}
              </p>
            )}
          </div>

          {/* Assignee */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-faint)' }}>
              <User size={13} />
              Assignee
            </label>
            {isAdmin ? (
              <Select
                value={task.assigneeUserId ?? ''}
                onChange={(e) => void handleAssigneeChange(e.target.value)}
                disabled={saving}
              >
                <option value="">Non assigne</option>
                {teamMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name ?? m.email}
                  </option>
                ))}
              </Select>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text)' }}>
                {task.assigneeName ?? task.assigneeEmail ?? 'Non assigne'}
              </p>
            )}
          </div>

          {/* Project */}
          <div className="space-y-1.5 sm:col-span-2">
            <label className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-faint)' }}>
              <FolderOpen size={13} />
              Projet
            </label>
            {isAdmin ? (
              <div className="flex items-center gap-2">
                <Select
                  value={task.projectId ?? ''}
                  onChange={(e) => void handleProjectChange(e.target.value)}
                  disabled={saving}
                  className="flex-1"
                >
                  <option value="">Aucun projet</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
                {task.projectId ? (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/app/pro/${businessId}/projects/${task.projectId}`}>
                      Voir
                    </Link>
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-sm" style={{ color: 'var(--text)' }}>
                  {task.projectName ?? 'Aucun projet'}
                </p>
                {task.projectId ? (
                  <Link
                    href={`/app/pro/${businessId}/projects/${task.projectId}`}
                    className="text-xs hover:underline"
                    style={{ color: 'var(--shell-accent)' }}
                  >
                    Voir le projet
                  </Link>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* ── Checklist ── */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Checklist</p>
            {checklistTotal > 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                {checklistDone}/{checklistTotal} terminee{checklistDone > 1 ? 's' : ''}
              </p>
            ) : null}
          </div>
          {checklistTotal > 0 ? (
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 rounded-full" style={{ background: 'var(--surface-2)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${checklistTotal > 0 ? (checklistDone / checklistTotal) * 100 : 0}%`,
                    background: checklistDone === checklistTotal ? 'var(--success)' : 'var(--shell-accent)',
                  }}
                />
              </div>
              <span className="text-xs font-medium" style={{ color: checklistDone === checklistTotal ? 'var(--success)' : 'var(--text-faint)' }}>
                {checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0}%
              </span>
            </div>
          ) : null}
        </div>

        {/* Items */}
        {checklistSorted.length > 0 ? (
          <div className="space-y-1">
            {checklistSorted.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 transition-colors group hover:bg-[var(--surface-hover)]"
              >
                <button
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => void handleToggleChecklistItem(item, !item.isCompleted)}
                  className="shrink-0 flex items-center justify-center rounded border-2 transition-all"
                  style={{
                    width: 20,
                    height: 20,
                    borderColor: item.isCompleted ? 'var(--success)' : 'var(--border)',
                    background: item.isCompleted ? 'var(--success)' : 'transparent',
                    borderRadius: 4,
                  }}
                >
                  {item.isCompleted ? <Check size={12} color="white" strokeWidth={3} /> : null}
                </button>
                <span
                  className={`flex-1 text-sm ${item.isCompleted ? 'line-through' : ''}`}
                  style={{ color: item.isCompleted ? 'var(--text-faint)' : 'var(--text)' }}
                >
                  {item.title}
                </span>
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => void handleDeleteChecklistItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    title="Supprimer"
                  >
                    <X size={14} style={{ color: 'var(--text-faint)' }} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs py-2" style={{ color: 'var(--text-faint)' }}>
            Aucun element dans la checklist.
          </p>
        )}

        {isAdmin ? (
          <form
            onSubmit={(e) => { e.preventDefault(); void handleAddChecklistItem(); }}
            className="flex items-center gap-2"
          >
            <Input
              className="flex-1"
              placeholder="Ajouter un element..."
              value={checklistTitle}
              onChange={(e) => setChecklistTitle(e.target.value)}
              disabled={checklistSaving}
            />
            <Button size="sm" type="submit" disabled={checklistSaving || !checklistTitle.trim()}>
              <Plus size={14} />
            </Button>
          </form>
        ) : null}
      </Card>

      {/* ── Danger zone ── */}
      {isAdmin ? (
        <div className="flex justify-end pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            className="text-[var(--danger)] border-[var(--danger)] hover:bg-[var(--danger-bg)]"
          >
            <Trash2 size={14} className="mr-1.5" />
            Supprimer la tache
          </Button>
        </div>
      ) : null}

      {/* ── Delete modal ── */}
      <Modal
        open={deleteOpen}
        onCloseAction={() => { if (!deleting) setDeleteOpen(false); }}
        title="Supprimer cette tache ?"
        description="Cette action est irreversible. La tache et sa checklist seront definitivement supprimees."
      >
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
            Annuler
          </Button>
          <Button
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="bg-[var(--danger)] text-white hover:opacity-90"
          >
            {deleting ? 'Suppression...' : 'Supprimer'}
          </Button>
        </div>
      </Modal>

      {/* ── Help request modal ── */}
      <Modal
        open={helpOpen}
        onCloseAction={() => { if (!helpSending) setHelpOpen(false); }}
        title="Demander de l'aide"
        description="La tache sera automatiquement marquee comme bloquee et un message sera envoye au destinataire."
      >
        <div className="space-y-4">
          {/* Message */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text-faint)' }}>
              Message (optionnel)
            </label>
            <textarea
              value={helpMessage}
              onChange={(e) => setHelpMessage(e.target.value)}
              placeholder="Decrivez votre probleme..."
              className="w-full rounded-lg border px-3 py-2 text-sm resize-none"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                minHeight: 80,
              }}
              maxLength={2000}
              disabled={helpSending}
            />
          </div>

          {/* Recipient picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text-faint)' }}>
              Envoyer a
            </label>
            <div
              className="rounded-lg border overflow-hidden"
              style={{ borderColor: 'var(--border)', maxHeight: 280, overflowY: 'auto' }}
            >
              {/* Project group option */}
              {task.projectId && inProject.length > 0 ? (
                <div>
                  <div
                    className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--text-faint)', background: 'var(--surface-2)' }}
                  >
                    Projet — {task.projectName}
                  </div>
                  {/* Group option */}
                  <button
                    type="button"
                    onClick={() => { setHelpIsProjectGroup(true); setHelpRecipient(''); }}
                    className="flex items-center gap-3 w-full px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-hover)]"
                    style={{
                      background: helpIsProjectGroup ? 'color-mix(in srgb, var(--shell-accent) 10%, transparent)' : undefined,
                    }}
                  >
                    <div
                      className="shrink-0 rounded-full border-2 flex items-center justify-center"
                      style={{
                        width: 18, height: 18,
                        borderColor: helpIsProjectGroup ? 'var(--shell-accent)' : 'var(--border)',
                      }}
                    >
                      {helpIsProjectGroup ? (
                        <div className="rounded-full" style={{ width: 10, height: 10, background: 'var(--shell-accent)' }} />
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Users size={15} style={{ color: 'var(--shell-accent)' }} className="shrink-0" />
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Tout le groupe</p>
                        <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                          {inProject.length} membre{inProject.length > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </button>
                  {/* Individual project members */}
                  {inProject.map((m) => (
                    <RecipientRow
                      key={m.userId}
                      member={m}
                      selected={!helpIsProjectGroup && helpRecipient === m.userId}
                      onSelect={() => { setHelpRecipient(m.userId); setHelpIsProjectGroup(false); }}
                    />
                  ))}
                </div>
              ) : null}

              {/* Members by pole */}
              {Object.entries(byPole).map(([poleName, poleMembers]) => (
                <RecipientGroup
                  key={poleName}
                  title={`Pole — ${poleName}`}
                  members={poleMembers}
                  selected={!helpIsProjectGroup ? helpRecipient : ''}
                  onSelect={(id) => { setHelpRecipient(id); setHelpIsProjectGroup(false); }}
                />
              ))}

              {/* Other members */}
              {other.length > 0 ? (
                <RecipientGroup
                  title="Equipe"
                  members={other}
                  selected={!helpIsProjectGroup ? helpRecipient : ''}
                  onSelect={(id) => { setHelpRecipient(id); setHelpIsProjectGroup(false); }}
                />
              ) : null}

              {inProject.length === 0 && Object.keys(byPole).length === 0 && other.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: 'var(--text-faint)' }}>
                  Aucun membre disponible.
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setHelpOpen(false)} disabled={helpSending}>
              Annuler
            </Button>
            <Button
              onClick={() => void handleSendHelp()}
              disabled={helpSending || (!helpRecipient && !helpIsProjectGroup)}
            >
              {helpSending ? 'Envoi...' : 'Envoyer'}
            </Button>
          </div>
        </div>
      </Modal>
    </ProPageShell>
  );
}

/* ═══ Recipient row (for help modal) ═══ */

function RecipientRow({
  member: m,
  selected,
  onSelect,
}: {
  member: TeamMember;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex items-center gap-3 w-full px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-hover)]"
      style={{
        background: selected ? 'color-mix(in srgb, var(--shell-accent) 10%, transparent)' : undefined,
      }}
    >
      <div
        className="shrink-0 rounded-full border-2 flex items-center justify-center"
        style={{
          width: 18, height: 18,
          borderColor: selected ? 'var(--shell-accent)' : 'var(--border)',
        }}
      >
        {selected ? (
          <div className="rounded-full" style={{ width: 10, height: 10, background: 'var(--shell-accent)' }} />
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate" style={{ color: 'var(--text)' }}>{m.name ?? m.email}</p>
        <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
          {m.role === 'OWNER' ? 'Proprietaire' : m.role === 'ADMIN' ? 'Admin' : 'Membre'}
          {m.organizationUnit ? ` · ${m.organizationUnit.name}` : ''}
        </p>
      </div>
    </button>
  );
}

/* ═══ Recipient group (for help modal) ═══ */

function RecipientGroup({
  title,
  members,
  selected,
  onSelect,
}: {
  title: string;
  members: TeamMember[];
  selected: string;
  onSelect: (userId: string) => void;
}) {
  return (
    <div>
      <div
        className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: 'var(--text-faint)', background: 'var(--surface-2)' }}
      >
        {title}
      </div>
      {members.map((m) => (
        <RecipientRow
          key={m.userId}
          member={m}
          selected={selected === m.userId}
          onSelect={() => onSelect(m.userId)}
        />
      ))}
    </div>
  );
}
