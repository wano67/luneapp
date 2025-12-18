// src/app/app/pro/[businessId]/tasks/[taskId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchJson } from '@/lib/apiClient';

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

type Task = {
  id: string;
  businessId: string;
  projectId: string | null;
  projectName: string | null;
  assigneeUserId: string | null;
  assigneeEmail: string | null;
  assigneeName: string | null;
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

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

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
        setTask(res.data.item);
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
    </div>
  );
}
