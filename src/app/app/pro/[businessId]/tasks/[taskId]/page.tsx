// src/app/app/pro/[businessId]/tasks/[taskId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
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
};

type TaskDetailResponse = { item: Task };

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

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [categoryReferenceId, setCategoryReferenceId] = useState<string>('');
  const [tagReferenceIds, setTagReferenceIds] = useState<string[]>([]);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [referenceInfo, setReferenceInfo] = useState<string | null>(null);
  const [referencesSaving, setReferencesSaving] = useState(false);

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
  }, [businessId, taskId]);

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
        <p className="text-sm font-semibold text-rose-400">{error ?? 'Tâche introuvable.'}</p>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/app/pro/${businessId}/tasks`}>Retour à la liste</Link>
        </Button>
        {requestId ? (
          <p className="text-[10px] text-[var(--text-secondary)]">Request ID: {requestId}</p>
        ) : null}
      </Card>
    );
  }

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
              <Badge key={tag.id} variant="neutral" className="bg-emerald-50 text-emerald-700">
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
        {referenceError ? <p className="text-xs font-semibold text-rose-500">{referenceError}</p> : null}
        {referenceInfo ? <p className="text-xs text-emerald-500">{referenceInfo}</p> : null}
        <div className="flex justify-end">
          <Button onClick={() => void saveReferences()} disabled={!canEditReferences || referencesSaving}>
            {referencesSaving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
