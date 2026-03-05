// src/app/app/pro/[businessId]/tasks/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { ClipboardList } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { KpiCard } from '@/components/ui/kpi-card';
import { ProPageShell } from '@/components/pro/ProPageShell';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { useActiveBusiness } from '../../ActiveBusinessProvider';
import { ReferencePicker } from '../references/ReferencePicker';
import { useRowSelection } from '../../../components/selection/useRowSelection';
import { BulkActionBar } from '../../../components/selection/BulkActionBar';

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
  const readOnlyMessage = 'Action réservée aux admins/owners.';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'ALL'>('ALL');
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: '',
    status: 'TODO' as TaskStatus,
    projectId: '',
    assigneeUserId: '',
    dueDate: '',
    categoryReferenceId: '',
    tagReferenceIds: [] as string[],
  });

  const [deleteModal, setDeleteModal] = useState<Task | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const fetchController = useRef<AbortController | null>(null);
  const [readOnlyInfo, setReadOnlyInfo] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const { selectedArray, selectedCount, toggle, toggleAll, clear, isSelected } = useRowSelection();

  const filteredTasks = useMemo(() => {
    return statusFilter === 'ALL' ? tasks : tasks.filter((t) => t.status === statusFilter);
  }, [statusFilter, tasks]);

  const todoCount = useMemo(() => tasks.filter((t) => t.status === 'TODO').length, [tasks]);
  const inProgressCount = useMemo(() => tasks.filter((t) => t.status === 'IN_PROGRESS').length, [tasks]);

  function openCreate() {
    setEditing(null);
    setForm({
    title: '',
    status: 'TODO',
    projectId: '',
    assigneeUserId: '',
    dueDate: '',
    categoryReferenceId: '',
    tagReferenceIds: [],
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
    categoryReferenceId: task.categoryReferenceId ?? '',
    tagReferenceIds: task.tagReferences?.map((t) => t.id) ?? [],
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
      const normalized = res.data.items.map((item) => ({
        ...item,
        categoryReferenceId: item.categoryReferenceId ?? null,
        categoryReferenceName: item.categoryReferenceName ?? null,
        tagReferences: item.tagReferences ?? [],
      }));
      setTasks(normalized);
    } catch (err) {
      if (effectiveSignal?.aborted) return;
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

  useEffect(() => {
    const controller = new AbortController();
    async function loadRefs() {
      setReferenceError(null);
      const [catRes, tagRes] = await Promise.all([
        fetchJson<{ items: Array<{ id: string; name: string }> }>(
          `/api/pro/businesses/${businessId}/references?type=CATEGORY`,
          {},
          controller.signal
        ),
        fetchJson<{ items: Array<{ id: string; name: string }> }>(
          `/api/pro/businesses/${businessId}/references?type=TAG`,
          {},
          controller.signal
        ),
      ]);
      if (controller.signal.aborted) return;
      if (!catRes.ok || !catRes.data || !tagRes.ok || !tagRes.data) {
        const msg = catRes.error || tagRes.error || 'Impossible de charger les références.';
        setReferenceError(
          catRes.requestId || tagRes.requestId ? `${msg} (Ref: ${catRes.requestId || tagRes.requestId})` : msg
        );
      }
    }
    void loadRefs();
    return () => controller.abort();
  }, [businessId]);

  function handleChange<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isAdmin) {
      setActionError(readOnlyMessage);
      setReadOnlyInfo(readOnlyMessage);
      return;
    }
    setActionError(null);
    setInfo(null);
    setCreating(true);

    const payload = {
      title: form.title.trim(),
      status: form.status,
      projectId: form.projectId.trim() || undefined,
      assigneeUserId: form.assigneeUserId.trim() || undefined,
      dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
      categoryReferenceId: form.categoryReferenceId || null,
      tagReferenceIds: form.tagReferenceIds,
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
    if (!isAdmin) {
      setDeleteError(readOnlyMessage);
      setReadOnlyInfo(readOnlyMessage);
      return;
    }
    setDeleteError(null);
    const res = await fetchJson<null>(
      `/api/pro/businesses/${businessId}/tasks/${deleteModal.id}`,
      { method: 'DELETE' }
    );

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

  async function handleBulkDelete(ids: string[]) {
    if (!ids.length) return;
    if (!isAdmin) {
      setReadOnlyInfo(readOnlyMessage);
      return;
    }
    const ok = window.confirm(ids.length === 1 ? 'Supprimer cette tâche ?' : `Supprimer ${ids.length} tâches ?`);
    if (!ok) return;
    setBulkLoading(true);
    setBulkError(null);
    setInfo(null);
    let failed = 0;
    for (const id of ids) {
      const res = await fetchJson<null>(`/api/pro/businesses/${businessId}/tasks/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        failed += 1;
        setBulkError((prev) => prev ?? `Suppression partielle. Ref: ${res.requestId ?? 'N/A'}`);
      }
    }
    setBulkLoading(false);
    clear();
    await loadTasks();
    if (failed) {
      setBulkError((prev) => prev ?? 'Certaines suppressions ont échoué.');
    } else {
      setInfo('Tâches supprimées.');
    }
  }

  return (
    <ProPageShell
      backHref={`/app/pro/${businessId}`}
      backLabel="Dashboard"
      title="Tâches"
      subtitle="Base unique des tâches liées aux projets."
      actions={
        <Button
          onClick={() => {
            if (!isAdmin) {
              setReadOnlyInfo(readOnlyMessage);
              return;
            }
            openCreate();
          }}
          disabled={!isAdmin}
        >
          Nouvelle tâche
        </Button>
      }
    >
      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Total" value={tasks.length} delay={0} />
        <KpiCard label="À faire" value={todoCount} delay={50} />
        <KpiCard label="En cours" value={inProgressCount} delay={100} />
      </div>

      {/* Section header: icon + title + filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList size={18} style={{ color: 'var(--text-secondary)' }} />
          <span className="text-sm font-semibold text-[var(--text-primary)]">Tâches</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[{ value: 'ALL' as const, label: 'Tous' }, ...STATUS_OPTIONS].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt.value as TaskStatus | 'ALL')}
              className="rounded-full px-3 py-1.5 text-xs font-semibold transition"
              style={{
                background: statusFilter === opt.value ? 'var(--shell-accent-dark)' : 'var(--surface)',
                color: statusFilter === opt.value ? 'white' : 'var(--text)',
                border: statusFilter === opt.value ? 'none' : '1px solid var(--border)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback messages */}
      {info ? <span className="text-xs text-[var(--success)]">{info}</span> : null}
      {error ? <span className="text-xs text-[var(--danger)]">{error}</span> : null}
      {readOnlyInfo ? <span className="text-xs text-[var(--text-secondary)]">{readOnlyInfo}</span> : null}
      {referenceError ? (
        <p className="text-xs text-[var(--danger)]">{referenceError}</p>
      ) : null}

      {/* Table */}
      {loading ? (
        <p className="text-sm text-[var(--text-secondary)]">Chargement des tâches…</p>
      ) : (
        <div className="space-y-2">
          {bulkError ? <p className="text-xs font-semibold text-[var(--danger)]">{bulkError}</p> : null}
          <BulkActionBar
              count={selectedCount}
              onClear={clear}
              actions={[
                {
                  label: bulkLoading ? 'Suppression…' : 'Supprimer',
                  onClick: () => handleBulkDelete(selectedArray),
                  variant: 'danger',
                  disabled: !isAdmin || bulkLoading,
                },
              ]}
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Tout sélectionner"
                      className="h-4 w-4 accent-[var(--accent)]"
                      checked={filteredTasks.length > 0 && filteredTasks.every((t) => isSelected(t.id))}
                      onChange={() => toggleAll(filteredTasks.map((t) => t.id))}
                    />
                  </TableHead>
                  <TableHead>Titre</TableHead>
                  <TableHead>Projet</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Références</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.length === 0 ? (
                  <TableEmpty>Aucune tâche.</TableEmpty>
                ) : (
                  filteredTasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--accent)]"
                          checked={isSelected(task.id)}
                          onChange={() => toggle(task.id)}
                          aria-label="Sélectionner"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
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
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
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
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(task.dueDate)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="neutral"
                          className={
                            task.status === 'DONE'
                              ? 'bg-[var(--success-bg)] text-[var(--success)]'
                              : task.status === 'IN_PROGRESS'
                                ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                                : 'bg-[var(--warning-bg)] text-[var(--warning)]'
                          }
                        >
                          {STATUS_OPTIONS.find((s) => s.value === task.status)?.label ?? task.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (!isAdmin) {
                                setReadOnlyInfo(readOnlyMessage);
                                return;
                              }
                              openEdit(task);
                            }}
                            disabled={!isAdmin}
                          >
                            Modifier
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (!isAdmin) {
                                setReadOnlyInfo(readOnlyMessage);
                                return;
                              }
                              setDeleteModal(task);
                            }}
                            disabled={!isAdmin}
                          >
                            Supprimer
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

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
          <ReferencePicker
            businessId={businessId}
            categoryId={form.categoryReferenceId || null}
            tagIds={form.tagReferenceIds}
            onCategoryChange={(id) => handleChange('categoryReferenceId', id ?? '')}
            onTagsChange={(ids) => handleChange('tagReferenceIds', ids)}
            disabled={!isAdmin || creating}
            title="Références"
          />
          <div className="flex items-center justify-between">
            {actionError ? <p className="text-xs text-[var(--danger)]">{actionError}</p> : null}
            {!isAdmin ? (
              <p className="text-[11px] text-[var(--text-secondary)]">Lecture seule : création/édition bloquée.</p>
            ) : null}
            <div className="flex gap-2">
              <Button variant="outline" type="button" onClick={() => setModalOpen(false)} disabled={creating}>
                Annuler
              </Button>
              <Button type="submit" disabled={creating || !isAdmin}>
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
          {deleteError ? <p className="text-xs text-[var(--danger)]">{deleteError}</p> : null}
          {!isAdmin ? (
            <p className="text-[11px] text-[var(--text-secondary)]">Suppression réservée aux admins/owners.</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteModal(null)}>
              Annuler
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={!isAdmin}>
              Supprimer
            </Button>
          </div>
        </div>
      </Modal>
    </ProPageShell>
  );
}
