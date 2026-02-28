// src/app/app/pro/[businessId]/tasks/[taskId]/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchJson } from '@/lib/apiClient';
import { ReferencePicker } from '../../references/ReferencePicker';
import { useActiveBusiness } from '../../../ActiveBusinessProvider';

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

type Task = {
  id: string;
  businessId: string;
  projectId: string | null;
  projectName: string | null;
  parentTaskId: string | null;
  assigneeUserId: string | null;
  assigneeEmail: string | null;
  assigneeName: string | null;
  categoryReferenceId: string | null;
  categoryReferenceName: string | null;
  tagReferences: { id: string; name: string }[];
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  subtasksCount?: number;
  checklistCount?: number;
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

type TaskDetailResponse = { item: Task; subtasks?: Task[] };
type ChecklistResponse = { items: ChecklistItem[] };

const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'À faire',
  IN_PROGRESS: 'En cours',
  DONE: 'Terminé',
};

function formatDate(value: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return value;
  }
}

export default function TaskDetailPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const taskId = (params?.taskId ?? '') as string;
  const activeCtx = useActiveBusiness({ optional: true });
  const role = activeCtx?.activeBusiness?.role;
  const canEditReferences = role === 'ADMIN' || role === 'OWNER';
  const canEditTask = role === 'ADMIN' || role === 'OWNER';

  const [task, setTask] = useState<Task | null>(null);
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [categoryReferenceId, setCategoryReferenceId] = useState<string>('');
  const [tagReferenceIds, setTagReferenceIds] = useState<string[]>([]);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [referenceInfo, setReferenceInfo] = useState<string | null>(null);
  const [referencesSaving, setReferencesSaving] = useState(false);
  const [subtasksOpen, setSubtasksOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [checklistTitle, setChecklistTitle] = useState('');
  const [subtaskInfo, setSubtaskInfo] = useState<string | null>(null);
  const [checklistInfo, setChecklistInfo] = useState<string | null>(null);
  const [subtaskSaving, setSubtaskSaving] = useState(false);
  const [checklistSaving, setChecklistSaving] = useState(false);

  const loadChecklist = useCallback(
    async (signal?: AbortSignal) => {
      const res = await fetchJson<ChecklistResponse>(
        `/api/pro/businesses/${businessId}/tasks/${taskId}/checklist`,
        {},
        signal
      );
      if (!res.ok || !res.data) {
        if (res.status === 401) {
          const from = window.location.pathname + window.location.search;
          window.location.href = `/login?from=${encodeURIComponent(from)}`;
          return;
        }
        return;
      }
      setChecklistItems(res.data.items ?? []);
    },
    [businessId, taskId]
  );

  const reloadTask = useCallback(async () => {
    const res = await fetchJson<TaskDetailResponse>(
      `/api/pro/businesses/${businessId}/tasks/${taskId}`
    );
    if (!res.ok || !res.data) return;
    const normalized: Task = {
      ...res.data.item,
      categoryReferenceId: res.data.item.categoryReferenceId ?? null,
      categoryReferenceName: res.data.item.categoryReferenceName ?? null,
      tagReferences: res.data.item.tagReferences ?? [],
    };
    setTask(normalized);
    setSubtasks(res.data.subtasks ?? []);
  }, [businessId, taskId]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchJson<TaskDetailResponse>(
          `/api/pro/businesses/${businessId}/tasks/${taskId}`,
          {},
          controller.signal
        );
        setRequestId(res.requestId);
        if (controller.signal.aborted) return;
        if (res.status === 401) {
          const from = window.location.pathname + window.location.search;
          window.location.href = `/login?from=${encodeURIComponent(from)}`;
          return;
        }
        if (!res.ok || !res.data) {
          setError(
            res.requestId ? `${res.error ?? 'Tâche introuvable.'} (Ref: ${res.requestId})` : res.error ?? 'Tâche introuvable.'
          );
          setTask(null);
          return;
        }
        const normalized: Task = {
          ...res.data.item,
          categoryReferenceId: res.data.item.categoryReferenceId ?? null,
          categoryReferenceName: res.data.item.categoryReferenceName ?? null,
          tagReferences: res.data.item.tagReferences ?? [],
        };
        setTask(normalized);
        setCategoryReferenceId(normalized.categoryReferenceId ?? '');
        setTagReferenceIds(normalized.tagReferences.map((t) => t.id));
        setSubtasks(res.data.subtasks ?? []);
        void loadChecklist(controller.signal);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error(err);
        setError('Impossible de charger la tâche.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [businessId, taskId, loadChecklist]);

  async function saveReferences() {
    if (!canEditReferences) return;
    setReferenceError(null);
    setReferenceInfo(null);
    setReferencesSaving(true);
    const res = await fetchJson<TaskDetailResponse>(
      `/api/pro/businesses/${businessId}/tasks/${taskId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryReferenceId: categoryReferenceId || null,
          tagReferenceIds,
        }),
      }
    );
    setRequestId(res.requestId);
    if (res.status === 401) {
      const from = window.location.pathname + window.location.search;
      window.location.href = `/login?from=${encodeURIComponent(from)}`;
      return;
    }
    if (!res.ok || !res.data) {
      const msg = res.error ?? 'Mise à jour impossible.';
      setReferenceError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      setReferencesSaving(false);
      return;
    }
    const normalized: Task = {
      ...res.data.item,
      categoryReferenceId: res.data.item.categoryReferenceId ?? null,
      categoryReferenceName: res.data.item.categoryReferenceName ?? null,
      tagReferences: res.data.item.tagReferences ?? [],
    };
    setTask(normalized);
    setCategoryReferenceId(normalized.categoryReferenceId ?? '');
    setTagReferenceIds(normalized.tagReferences.map((t) => t.id));
    setReferenceInfo('Références mises à jour.');
    setReferenceError(null);
    setReferencesSaving(false);
  }

  async function handleAddSubtask() {
    if (!canEditTask || subtaskSaving) return;
    const title = subtaskTitle.trim();
    if (!title) {
      setSubtaskInfo('Titre requis.');
      return;
    }
    setSubtaskSaving(true);
    setSubtaskInfo(null);
    const res = await fetchJson<TaskDetailResponse>(
      `/api/pro/businesses/${businessId}/tasks`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, parentTaskId: taskId }),
      }
    );
    if (!res.ok) {
      setSubtaskInfo(res.error ?? 'Création impossible.');
      setSubtaskSaving(false);
      return;
    }
    setSubtaskTitle('');
    setSubtaskInfo('Sous-tâche ajoutée.');
    await reloadTask();
    setSubtaskSaving(false);
  }

  async function handleAddChecklistItem() {
    if (!canEditTask || checklistSaving) return;
    const title = checklistTitle.trim();
    if (!title) {
      setChecklistInfo('Titre requis.');
      return;
    }
    setChecklistSaving(true);
    setChecklistInfo(null);
    const res = await fetchJson<{ item: ChecklistItem }>(
      `/api/pro/businesses/${businessId}/tasks/${taskId}/checklist`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      }
    );
    if (!res.ok) {
      setChecklistInfo(res.error ?? 'Ajout impossible.');
      setChecklistSaving(false);
      return;
    }
    setChecklistTitle('');
    await loadChecklist();
    setChecklistInfo('Checklist mise à jour.');
    setChecklistSaving(false);
  }

  async function handleToggleChecklistItem(item: ChecklistItem, nextValue: boolean) {
    if (!canEditTask) return;
    const res = await fetchJson<{ item: ChecklistItem }>(
      `/api/pro/businesses/${businessId}/tasks/${taskId}/checklist/${item.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: nextValue }),
      }
    );
    if (!res.ok) {
      setChecklistInfo(res.error ?? 'Mise à jour impossible.');
      return;
    }
    await loadChecklist();
    setChecklistInfo('Checklist mise à jour.');
  }

  async function moveChecklistItem(itemId: string, direction: 'up' | 'down') {
    if (!canEditTask) return;
    const sorted = [...checklistItems].sort((a, b) => a.position - b.position);
    const index = sorted.findIndex((item) => item.id === itemId);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= sorted.length) return;
    const current = sorted[index];
    const target = sorted[targetIndex];
    await fetchJson(
      `/api/pro/businesses/${businessId}/tasks/${taskId}/checklist/${current.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: target.position }),
      }
    );
    await fetchJson(
      `/api/pro/businesses/${businessId}/tasks/${taskId}/checklist/${target.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: current.position }),
      }
    );
    await loadChecklist();
  }

  if (loading) {
    return (
      <Card className="p-5">
        <p className="text-sm text-[var(--text-secondary)]">Chargement de la tâche…</p>
      </Card>
    );
  }

  if (!task) {
    return (
      <Card className="space-y-2 p-5">
        <p className="text-sm font-semibold text-[var(--danger)]">{error ?? 'Tâche introuvable.'}</p>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/app/pro/${businessId}/tasks`}>Retour à la liste</Link>
        </Button>
        {requestId ? (
          <p className="text-[10px] text-[var(--text-secondary)]">Request ID: {requestId}</p>
        ) : null}
      </Card>
    );
  }

  const checklistTotal = checklistItems.length;
  const checklistDone = checklistItems.filter((item) => item.isCompleted).length;
  const checklistSorted = [...checklistItems].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-4">
      <Card className="space-y-2 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
              Tâche
            </p>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">
              {task.title}
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Business #{task.businessId} · créée le {formatDate(task.createdAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">
              {STATUS_LABELS[task.status] ?? task.status}
            </Badge>
            {task.categoryReferenceName ? (
              <Badge variant="neutral" className="bg-indigo-50 text-indigo-700">
                {task.categoryReferenceName}
              </Badge>
            ) : null}
            {task.tagReferences?.map((tag) => (
              <Badge key={tag.id} variant="neutral" className="bg-[var(--success-bg)] text-[var(--success)]">
                {tag.name}
              </Badge>
            ))}
            {requestId ? (
              <Badge variant="neutral" className="bg-[var(--surface-2)]">
                Ref {requestId}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href={`/app/pro/${businessId}/tasks`}>Retour</Link>
          </Button>
          {task.projectId ? (
            <Button size="sm" variant="ghost" asChild>
              <Link href={`/app/pro/${businessId}/projects/${task.projectId}`}>
                Voir le projet
              </Link>
            </Button>
          ) : null}
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
            <p className="text-xs text-[var(--text-secondary)]">Statut</p>
            <p className="text-sm text-[var(--text-primary)]">
              {STATUS_LABELS[task.status] ?? task.status}
            </p>
          </Card>
          <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
            <p className="text-xs text-[var(--text-secondary)]">Échéance</p>
            <p className="text-sm text-[var(--text-primary)]">{formatDate(task.dueDate)}</p>
          </Card>
        </div>
        <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
          <p className="text-xs text-[var(--text-secondary)]">Assignee</p>
          <p className="text-sm text-[var(--text-primary)]">
            {task.assigneeEmail ?? task.assigneeName ?? 'Non assigné'}
          </p>
        </Card>
        <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
          <p className="text-xs text-[var(--text-secondary)]">Projet</p>
          <p className="text-sm text-[var(--text-primary)]">
            {task.projectName ?? '—'}
          </p>
        </Card>
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Sous-tâches</p>
            <p className="text-xs text-[var(--text-secondary)]">
              {subtasks.length} sous-tâche{subtasks.length > 1 ? 's' : ''}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setSubtasksOpen((prev) => !prev)}>
            {subtasksOpen ? 'Voir moins' : 'Voir +'}
          </Button>
        </div>
        {subtasksOpen ? (
          <div className="space-y-2">
            {subtasks.length ? (
              subtasks.map((subtask) => (
                <Link
                  key={subtask.id}
                  href={`/app/pro/${businessId}/tasks/${subtask.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-2 text-sm transition hover:border-[var(--border)] hover:bg-[var(--surface)]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[var(--text-primary)]">{subtask.title}</p>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      {subtask.assigneeName ?? subtask.assigneeEmail ?? 'Non assigné'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                    <Badge variant="neutral">{STATUS_LABELS[subtask.status] ?? subtask.status}</Badge>
                    <span>{formatDate(subtask.dueDate)}</span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-xs text-[var(--text-secondary)]">Aucune sous-tâche.</p>
            )}
            {canEditTask ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] sm:flex-1"
                  placeholder="Nouvelle sous-tâche"
                  value={subtaskTitle}
                  onChange={(e) => setSubtaskTitle(e.target.value)}
                />
                <Button size="sm" onClick={() => void handleAddSubtask()} disabled={subtaskSaving}>
                  {subtaskSaving ? 'Ajout…' : 'Ajouter'}
                </Button>
              </div>
            ) : null}
            {subtaskInfo ? <p className="text-xs text-[var(--success)]">{subtaskInfo}</p> : null}
          </div>
        ) : null}
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Checklist</p>
            <p className="text-xs text-[var(--text-secondary)]">
              {checklistDone}/{checklistTotal} terminée{checklistDone > 1 ? 's' : ''}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setChecklistOpen((prev) => !prev)}>
            {checklistOpen ? 'Voir moins' : 'Voir +'}
          </Button>
        </div>
        {checklistOpen ? (
          <div className="space-y-2">
            {checklistSorted.length ? (
              checklistSorted.map((item, index) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-2 text-sm"
                >
                  <label className="flex min-w-0 items-center gap-2 text-[var(--text-primary)]">
                    <input
                      type="checkbox"
                      checked={item.isCompleted}
                      onChange={(e) => void handleToggleChecklistItem(item, e.target.checked)}
                      disabled={!canEditTask}
                    />
                    <span className={item.isCompleted ? 'line-through text-[var(--text-secondary)]' : ''}>
                      {item.title}
                    </span>
                  </label>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void moveChecklistItem(item.id, 'up')}
                      disabled={!canEditTask || index === 0}
                    >
                      ↑
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void moveChecklistItem(item.id, 'down')}
                      disabled={!canEditTask || index === checklistSorted.length - 1}
                    >
                      ↓
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-[var(--text-secondary)]">Aucun élément.</p>
            )}
            {canEditTask ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] sm:flex-1"
                  placeholder="Nouvel item"
                  value={checklistTitle}
                  onChange={(e) => setChecklistTitle(e.target.value)}
                />
                <Button size="sm" onClick={() => void handleAddChecklistItem()} disabled={checklistSaving}>
                  {checklistSaving ? 'Ajout…' : 'Ajouter'}
                </Button>
              </div>
            ) : null}
            {checklistInfo ? <p className="text-xs text-[var(--success)]">{checklistInfo}</p> : null}
          </div>
        ) : null}
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Références</p>
            <p className="text-xs text-[var(--text-secondary)]">Catégorie et tags de la tâche.</p>
          </div>
          <Badge variant="neutral">{canEditReferences ? 'Admin/Owner' : 'Lecture seule'}</Badge>
        </div>
        <ReferencePicker
          businessId={businessId}
          categoryId={categoryReferenceId || null}
          tagIds={tagReferenceIds}
          onCategoryChange={(id) => setCategoryReferenceId(id ?? '')}
          onTagsChange={(ids) => setTagReferenceIds(ids)}
          disabled={!canEditReferences || referencesSaving}
          title="Références tâche"
        />
        {referenceError ? <p className="text-xs font-semibold text-[var(--danger)]">{referenceError}</p> : null}
        {referenceInfo ? <p className="text-xs text-[var(--success)]">{referenceInfo}</p> : null}
        <div className="flex justify-end">
          <Button onClick={() => void saveReferences()} disabled={!canEditReferences || referencesSaving}>
            {referencesSaving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
