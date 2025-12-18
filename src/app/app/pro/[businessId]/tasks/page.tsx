// src/app/app/pro/[businessId]/tasks/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { useActiveBusiness } from '../../ActiveBusinessProvider';

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

type TaskListResponse = { items: Task[] };
type TaskDetailResponse = { item: Task };

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'TODO', label: 'À faire' },
  { value: 'IN_PROGRESS', label: 'En cours' },
  { value: 'DONE', label: 'Terminé' },
];

function formatDate(value: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return value;
  }
}

export default function TasksPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const activeCtx = useActiveBusiness({ optional: true });
  const actorRole = activeCtx?.activeBusiness?.role ?? null;
  const isAdmin = actorRole === 'OWNER' || actorRole === 'ADMIN';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'ALL'>('ALL');
  const [info, setInfo] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: '',
    status: 'TODO' as TaskStatus,
    projectId: '',
    assigneeUserId: '',
    dueDate: '',
  });

  const [deleteModal, setDeleteModal] = useState<Task | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const fetchController = useRef<AbortController | null>(null);

  const filteredTasks = useMemo(() => {
    return statusFilter === 'ALL' ? tasks : tasks.filter((t) => t.status === statusFilter);
  }, [statusFilter, tasks]);

  function openCreate() {
    setEditing(null);
    setForm({
      title: '',
      status: 'TODO',
      projectId: '',
      assigneeUserId: '',
      dueDate: '',
    });
    setModalOpen(true);
  }

  function openEdit(task: Task) {
    setEditing(task);
    setForm({
      title: task.title,
      status: task.status,
      projectId: task.projectId ?? '',
      assigneeUserId: task.assigneeUserId ?? '',
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
    });
    setModalOpen(true);
  }

  async function loadTasks(signal?: AbortSignal) {
    const controller = signal ? null : new AbortController();
    const effectiveSignal = signal ?? controller?.signal;
    if (controller) {
      fetchController.current?.abort();
      fetchController.current = controller;
    }

    try {
      setLoading(true);
      setError(null);
      const query = new URLSearchParams();
      if (statusFilter !== 'ALL') query.set('status', statusFilter);
      const res = await fetchJson<TaskListResponse>(
        `/api/pro/businesses/${businessId}/tasks${query.toString() ? `?${query.toString()}` : ''}`,
        {},
        effectiveSignal
      );
      setRequestId(res.requestId);

      if (effectiveSignal?.aborted) return;
      if (res.status === 401) {
        const from = window.location.pathname + window.location.search;
        window.location.href = `/login?from=${encodeURIComponent(from)}`;
        return;
      }
      if (!res.ok || !res.data) {
        setError(
          res.requestId
            ? `${res.error ?? 'Erreur de chargement.'} (Ref: ${res.requestId})`
            : res.error ?? 'Erreur de chargement.'
        );
        setTasks([]);
        return;
      }
      setTasks(res.data.items);
    } catch (err) {
      if (effectiveSignal?.aborted) return;
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      if (!effectiveSignal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    void loadTasks();
    return () => fetchController.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, statusFilter]);

  function handleChange<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setActionError(null);
    setInfo(null);
    setCreating(true);

    const payload = {
      title: form.title.trim(),
      status: form.status,
      projectId: form.projectId.trim() || undefined,
      assigneeUserId: form.assigneeUserId.trim() || undefined,
      dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
    };

    const endpoint = editing
      ? `/api/pro/businesses/${businessId}/tasks/${editing.id}`
      : `/api/pro/businesses/${businessId}/tasks`;
    const method = editing ? 'PATCH' : 'POST';

    const res = await fetchJson<TaskDetailResponse>(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setRequestId(res.requestId);

    if (res.status === 401) {
      const from = window.location.pathname + window.location.search;
      window.location.href = `/login?from=${encodeURIComponent(from)}`;
      return;
    }

    if (!res.ok || !res.data) {
      setActionError(
        res.requestId ? `${res.error ?? 'Action impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Action impossible.'
      );
      setCreating(false);
      return;
    }

    setInfo(editing ? 'Tâche mise à jour.' : 'Tâche créée.');
    setModalOpen(false);
    setCreating(false);
    setEditing(null);
    await loadTasks();
  }

  async function confirmDelete() {
    if (!deleteModal) return;
    setDeleteError(null);
    const res = await fetchJson<null>(
      `/api/pro/businesses/${businessId}/tasks/${deleteModal.id}`,
      { method: 'DELETE' }
    );
    setRequestId(res.requestId);
    if (res.status === 401) {
      const from = window.location.pathname + window.location.search;
      window.location.href = `/login?from=${encodeURIComponent(from)}`;
      return;
    }
    if (!res.ok) {
      setDeleteError(
        res.requestId ? `${res.error ?? 'Suppression impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Suppression impossible.'
      );
      return;
    }
    setInfo('Tâche supprimée.');
    setDeleteModal(null);
    await loadTasks();
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-2 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
          Tâches
        </p>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">Tâches & production</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Base unique des tâches liées aux projets pour suivre charge et urgences.
            </p>
          </div>
          {isAdmin ? (
            <Button onClick={openCreate}>Nouvelle tâche</Button>
          ) : null}
        </div>
        {requestId ? (
          <p className="text-[10px] text-[var(--text-secondary)]">Request ID: {requestId}</p>
        ) : null}
      </Card>

      <Card className="space-y-4 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {[{ value: 'ALL', label: 'Tous' }, ...STATUS_OPTIONS].map((opt) => (
              <Button
                key={opt.value}
                size="sm"
                variant="outline"
                onClick={() => setStatusFilter(opt.value as TaskStatus | 'ALL')}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          {info ? <span className="text-xs text-emerald-500">{info}</span> : null}
          {error ? <span className="text-xs text-rose-500">{error}</span> : null}
        </div>

        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Chargement des tâches…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titre</TableHead>
                <TableHead>Projet</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Échéance</TableHead>
                <TableHead>Statut</TableHead>
                {isAdmin ? <TableHead>Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.length === 0 ? (
                <TableEmpty>Aucune tâche.</TableEmpty>
              ) : (
                filteredTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-semibold text-[var(--text-primary)]">
                      <Link href={`/app/pro/${businessId}/tasks/${task.id}`} className="hover:underline">
                        {task.title}
                      </Link>
                      <p className="text-[10px] text-[var(--text-secondary)]">
                        Créée le {formatDate(task.createdAt)}
                      </p>
                    </TableCell>
                    <TableCell>{task.projectName ?? '—'}</TableCell>
                    <TableCell>{task.assigneeEmail ?? task.assigneeName ?? '—'}</TableCell>
                    <TableCell>{formatDate(task.dueDate)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="neutral"
                        className={
                          task.status === 'DONE'
                            ? 'bg-emerald-100 text-emerald-700'
                            : task.status === 'IN_PROGRESS'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700'
                        }
                      >
                        {STATUS_OPTIONS.find((s) => s.value === task.status)?.label ?? task.status}
                      </Badge>
                    </TableCell>
                    {isAdmin ? (
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(task)}>
                            Modifier
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setDeleteModal(task)}>
                            Supprimer
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onCloseAction={() => {
          if (creating) return;
          setModalOpen(false);
          setEditing(null);
          setActionError(null);
        }}
        title={editing ? 'Modifier la tâche' : 'Nouvelle tâche'}
        description="Définis le titre, le statut, l’assignee et l’échéance."
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            label="Titre"
            value={form.title}
            onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('title', e.target.value)}
            error={actionError ?? undefined}
          />
          <Select
            label="Statut"
            value={form.status}
            onChange={(e) => handleChange('status', e.target.value as TaskStatus)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Projet ID (optionnel)"
              value={form.projectId}
              onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('projectId', e.target.value)}
              placeholder="ID projet (même business)"
            />
            <Input
              label="Assignee userId (optionnel)"
              value={form.assigneeUserId}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                handleChange('assigneeUserId', e.target.value)
              }
              placeholder="ID membre business"
            />
          </div>
          <Input
            label="Échéance (optionnel)"
            type="date"
            value={form.dueDate}
            onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('dueDate', e.target.value)}
          />
          <div className="flex items-center justify-between">
            {actionError ? <p className="text-xs text-rose-500">{actionError}</p> : null}
            <div className="flex gap-2">
              <Button variant="outline" type="button" onClick={() => setModalOpen(false)} disabled={creating}>
                Annuler
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Créer'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!deleteModal}
        onCloseAction={() => setDeleteModal(null)}
        title="Supprimer cette tâche ?"
        description={deleteModal ? `« ${deleteModal.title} » sera supprimée.` : undefined}
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--text-secondary)]">
            Action définitive. Les liens projet/assignee seront perdus.
          </p>
          {deleteError ? <p className="text-xs text-rose-500">{deleteError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteModal(null)}>
              Annuler
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Supprimer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
