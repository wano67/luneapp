// src/app/app/pro/[businessId]/projects/page.tsx
'use client';

import { useEffect, useRef, useState, type FormEvent, type ChangeEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { useActiveBusiness } from '../../ActiveBusinessProvider';
import RoleBanner from '@/components/RoleBanner';
import { ReferencePicker } from '../references/ReferencePicker';
import { useRowSelection } from '../../../components/selection/useRowSelection';
import { BulkActionBar } from '../../../components/selection/BulkActionBar';
import { PageHeader } from '../../../components/PageHeader';
import { FaviconAvatar } from '../../../components/FaviconAvatar';

type ProjectStatus = 'PLANNED' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
type ProjectQuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'SIGNED';
type ProjectDepositStatus = 'NOT_REQUIRED' | 'PENDING' | 'PAID';

type Project = {
  id: string;
  businessId: string;
  clientId: string | null;
  clientName: string | null;
  categoryReferenceId?: string | null;
  categoryReferenceName?: string | null;
  tagReferences?: { id: string; name: string }[];
  name: string;
  status: ProjectStatus;
  quoteStatus: ProjectQuoteStatus;
  depositStatus: ProjectDepositStatus;
  startedAt: string | null;
  archivedAt: string | null;
  startDate: string | null;
  endDate: string | null;
  progress?: number;
  tasksSummary?: { total: number; open: number; done: number; progressPct: number };
  createdAt: string;
  updatedAt: string;
};

type ProjectListResponse = {
  items: Project[];
};

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'PLANNED', label: 'Planifié' },
  { value: 'ACTIVE', label: 'En cours' },
  { value: 'ON_HOLD', label: 'Pause' },
  { value: 'COMPLETED', label: 'Terminé' },
  { value: 'CANCELLED', label: 'Annulé' },
];

function statusLabel(status: ProjectStatus) {
  return STATUS_OPTIONS.find((opt) => opt.value === status)?.label ?? status;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return value;
  }
}

export default function ProjectsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const router = useRouter();
  const activeCtx = useActiveBusiness({ optional: true });
  const isAdmin = activeCtx?.activeBusiness?.role === 'ADMIN' || activeCtx?.activeBusiness?.role === 'OWNER';

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [archivedFilter, setArchivedFilter] = useState<'true' | 'false'>('false');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'updatedAt'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('PLANNED');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryReferenceId, setCategoryReferenceId] = useState<string>('');
  const [tagReferenceIds, setTagReferenceIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [readOnlyInfo, setReadOnlyInfo] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const { selectedArray, selectedCount, toggle, toggleAll, clear, isSelected, allSelected, someSelected } =
    useRowSelection();

  const fetchController = useRef<AbortController | null>(null);

  function resetForm() {
    setName('');
    setClientId('');
    setStatus('PLANNED');
    setStartDate('');
    setEndDate('');
    setCategoryReferenceId('');
    setTagReferenceIds([]);
    setCreateError(null);
    setSuccess(null);
  }

  function closeModal() {
    if (creating) return;
    resetForm();
    setEditing(null);
    setCreateOpen(false);
  }

  async function loadProjects(signal?: AbortSignal) {
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
      query.set('archived', archivedFilter);
      if (search.trim()) query.set('q', search.trim());

      const res = await fetchJson<ProjectListResponse>(
        `/api/pro/businesses/${businessId}/projects${query.toString() ? `?${query.toString()}` : ''}`,
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
            ? `${res.error ?? 'Impossible de charger les projets.'} (Ref: ${res.requestId})`
            : res.error ?? 'Impossible de charger les projets.'
        );
        setProjects([]);
        return;
      }

      const fetched = res.data.items.map((item) => ({ ...item, tagReferences: item.tagReferences ?? [] }));
      const sorted = [...fetched].sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        if (sortBy === 'name') return a.name.localeCompare(b.name) * dir;
        const aDate = sortBy === 'createdAt' ? new Date(a.createdAt).getTime() : new Date(a.updatedAt).getTime();
        const bDate = sortBy === 'createdAt' ? new Date(b.createdAt).getTime() : new Date(b.updatedAt).getTime();
        return (aDate - bDate) * dir;
      });
      setProjects(sorted);
    } catch (err) {
      if (effectiveSignal?.aborted) return;
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      if (!effectiveSignal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    void loadProjects();
    return () => fetchController.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, archivedFilter, search, sortBy, sortDir]);

  useEffect(() => {
    clear();
  }, [archivedFilter, clear]);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isAdmin) {
      setCreateError('Action réservée aux admins/owners.');
      setReadOnlyInfo('Lecture seule : demande un rôle admin pour créer ou modifier des projets.');
      return;
    }
    setCreateError(null);
    setActionError(null);
    setSuccess(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setCreateError('Nom requis.');
      return;
    }

    try {
      setCreating(true);
      const res = await fetchJson<Project>(`/api/pro/businesses/${businessId}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          clientId: clientId.trim() || undefined,
          status,
          categoryReferenceId: categoryReferenceId || null,
          tagReferenceIds,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
      });

      if (res.status === 401) {
        const from = window.location.pathname + window.location.search;
        window.location.href = `/login?from=${encodeURIComponent(from)}`;
        return;
      }

      if (!res.ok || !res.data) {
        setCreateError(
          res.requestId ? `${res.error ?? 'Création impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Création impossible.'
        );
        return;
      }

      resetForm();
      setCreateOpen(false);
      setSuccess('Projet créé.');
      await loadProjects();
    } catch (err) {
      console.error(err);
      setCreateError(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  function openEdit(project: Project) {
    if (!isAdmin) {
      setReadOnlyInfo('Action réservée aux admins/owners.');
      return;
    }
    setEditing(project);
    setName(project.name);
    setClientId(project.clientId ?? '');
    setStatus(project.status);
    setStartDate(project.startDate ? project.startDate.slice(0, 10) : '');
    setEndDate(project.endDate ? project.endDate.slice(0, 10) : '');
    setCategoryReferenceId(project.categoryReferenceId ?? '');
    setTagReferenceIds(project.tagReferences?.map((t) => t.id) ?? []);
    setCreateError(null);
    setSuccess(null);
    setActionError(null);
    setCreateOpen(true);
  }

  async function handleUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    if (!isAdmin) {
      setCreateError('Action réservée aux admins/owners.');
      setReadOnlyInfo('Lecture seule : demande un rôle admin pour modifier des projets.');
      return;
    }
    setCreateError(null);
    setActionError(null);
    setSuccess(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setCreateError('Nom requis.');
      return;
    }

    try {
      setCreating(true);
      const res = await fetchJson<Project>(
        `/api/pro/businesses/${businessId}/projects/${editing.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: trimmedName,
            clientId: clientId.trim() || null,
            status,
            categoryReferenceId: categoryReferenceId || null,
            tagReferenceIds,
            startDate: startDate || null,
            endDate: endDate || null,
          }),
        }
      );

      if (res.status === 401) {
        const from = window.location.pathname + window.location.search;
        window.location.href = `/login?from=${encodeURIComponent(from)}`;
        return;
      }

      if (!res.ok || !res.data) {
        const msg = res.error ?? 'Modification impossible.';
        setCreateError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
        return;
      }

      setSuccess('Projet mis à jour.');
      setCreateOpen(false);
      setEditing(null);
      resetForm();
      await loadProjects();
    } catch (err) {
      console.error(err);
      setCreateError(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    if (!isAdmin) {
      setActionError('Action réservée aux admins/owners.');
      setReadOnlyInfo('Lecture seule : suppression réservée aux admins.');
      return;
    }
    setActionError(null);
    setSuccess(null);
    try {
      const res = await fetchJson(
        `/api/pro/businesses/${businessId}/projects/${deleting.id}`,
        { method: 'DELETE' }
      );

      if (res.status === 401) {
        const from = window.location.pathname + window.location.search;
        window.location.href = `/login?from=${encodeURIComponent(from)}`;
        return;
      }

      if (!res.ok) {
        const msg = res.error ?? 'Suppression impossible.';
        setActionError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
        return;
      }

      setSuccess('Projet supprimé.');
      setDeleting(null);
      await loadProjects();
    } catch (err) {
      console.error(err);
      setActionError(getErrorMessage(err));
    }
  }

  const isArchivedView = archivedFilter === 'true';

  async function handleArchive(projectId: string) {
    if (!isAdmin) {
      setReadOnlyInfo('Lecture seule : archivage réservé aux admins.');
      return;
    }
    const res = await fetchJson(`/api/pro/businesses/${businessId}/projects/${projectId}/archive`, { method: 'POST' });
    if (!res.ok) {
      setActionError(res.requestId ? `${res.error ?? 'Archivage impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Archivage impossible.');
      return;
    }
    await loadProjects();
  }

  async function handleRestore(projectId: string) {
    if (!isAdmin) {
      setReadOnlyInfo('Lecture seule : restauration réservée aux admins.');
      return;
    }
    const res = await fetchJson(`/api/pro/businesses/${businessId}/projects/${projectId}/unarchive`, { method: 'POST' });
    if (!res.ok) {
      setActionError(res.requestId ? `${res.error ?? 'Restauration impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Restauration impossible.');
      return;
    }
    await loadProjects();
  }

  async function handleBulkArchive(ids: string[]) {
    if (!ids.length) return;
    if (!isAdmin) {
      setReadOnlyInfo('Lecture seule : archivage réservé aux admins.');
      return;
    }
    if (!window.confirm(ids.length === 1 ? 'Archiver ce projet ?' : `Archiver ${ids.length} projets ?`)) return;
    setBulkLoading(true);
    setBulkError(null);
    setSuccess(null);
    let failed = 0;
    for (const id of ids) {
      const res = await fetchJson(`/api/pro/businesses/${businessId}/projects/${id}/archive`, { method: 'POST' });
      if (!res.ok) {
        failed += 1;
        setBulkError((prev) => prev ?? `Archivage partiel. Ref: ${res.requestId ?? 'N/A'}`);
      }
    }
    setBulkLoading(false);
    clear();
    await loadProjects();
    if (failed) {
      setSuccess(null);
      setBulkError((prev) => prev ?? 'Certains projets non archivés.');
    } else {
      setSuccess('Projets archivés.');
    }
  }

  async function handleBulkRestore(ids: string[]) {
    if (!ids.length) return;
    if (!isAdmin) {
      setReadOnlyInfo('Lecture seule : restauration réservée aux admins.');
      return;
    }
    if (!window.confirm(ids.length === 1 ? 'Restaurer ce projet ?' : `Restaurer ${ids.length} projets ?`)) return;
    setBulkLoading(true);
    setBulkError(null);
    setSuccess(null);
    let failed = 0;
    for (const id of ids) {
      const res = await fetchJson(`/api/pro/businesses/${businessId}/projects/${id}/unarchive`, { method: 'POST' });
      if (!res.ok) {
        failed += 1;
        setBulkError((prev) => prev ?? `Restauration partielle. Ref: ${res.requestId ?? 'N/A'}`);
      }
    }
    setBulkLoading(false);
    clear();
    await loadProjects();
    if (failed) {
      setSuccess(null);
      setBulkError((prev) => prev ?? 'Certains projets non restaurés.');
    } else {
      setSuccess('Projets restaurés.');
    }
  }

  async function handleBulkDelete(ids: string[]) {
    if (!ids.length || !isArchivedView) return;
    if (!isAdmin) {
      setReadOnlyInfo('Lecture seule : suppression réservée aux admins.');
      return;
    }
    const ok = window.confirm(
      ids.length === 1 ? 'Supprimer définitivement ce projet archivé ?' : `Supprimer définitivement ${ids.length} projets ?`
    );
    if (!ok) return;
    setBulkLoading(true);
    setBulkError(null);
    setSuccess(null);
    let failed = 0;
    for (const id of ids) {
      const res = await fetchJson(`/api/pro/businesses/${businessId}/projects/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        failed += 1;
        setBulkError((prev) => prev ?? `Suppression partielle. Ref: ${res.requestId ?? 'N/A'}`);
      }
    }
    setBulkLoading(false);
    clear();
    await loadProjects();
    if (failed) {
      setSuccess(null);
      setBulkError((prev) => prev ?? 'Certaines suppressions ont échoué.');
    } else {
      setSuccess('Projets supprimés.');
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-4">
      <RoleBanner role={activeCtx?.activeBusiness?.role} />
      <PageHeader
        backHref="/app/pro"
        backLabel="Studio"
        title="Projets"
        subtitle="Suivez vos missions client, leurs tâches et leur facturation."
        primaryAction={{
          label: 'Nouveau projet',
          onClick: () => {
            if (!isAdmin) {
              setReadOnlyInfo('Lecture seule : demande un rôle admin pour créer ou modifier des projets.');
              return;
            }
            setCreateOpen(true);
          },
        }}
      />

      <Card className="space-y-3 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { value: 'false', label: 'Actifs' },
              { value: 'true', label: 'Archivés' },
            ].map((opt) => (
              <Button
                key={opt.value}
                size="sm"
                variant={archivedFilter === opt.value ? 'primary' : 'outline'}
                onClick={() => setArchivedFilter(opt.value as 'true' | 'false')}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center md:gap-3">
            <Input
              placeholder="Rechercher un projet…"
              value={search}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              className="md:w-64"
            />
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-2">
              <Select label="Trier par" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
                <option value="name">Nom</option>
                <option value="createdAt">Créé le</option>
                <option value="updatedAt">Mis à jour</option>
              </Select>
              <Select label="Ordre" value={sortDir} onChange={(e) => setSortDir(e.target.value as typeof sortDir)}>
                <option value="asc">Ascendant</option>
                <option value="desc">Descendant</option>
              </Select>
            </div>
          </div>
        </div>
      </Card>

      {success ? <p className="text-xs font-semibold text-emerald-500">{success}</p> : null}
      {actionError ? <p className="text-xs font-semibold text-rose-500">{actionError}</p> : null}
      {readOnlyInfo ? <p className="text-xs text-[var(--text-secondary)]">{readOnlyInfo}</p> : null}

      <div className="space-y-3">
        {bulkError ? <p className="text-xs font-semibold text-rose-500">{bulkError}</p> : null}
        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Chargement des projets…</p>
        ) : error ? (
          <div className="space-y-2">
            <p className="text-sm text-rose-400">{error}</p>
            <Button size="sm" variant="outline" onClick={() => loadProjects()}>
              Réessayer
            </Button>
          </div>
        ) : projects.length === 0 ? (
          <div className="space-y-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-5 text-sm text-[var(--text-secondary)]">
            <p>{archivedFilter === 'true' ? 'Aucun projet archivé.' : 'Aucun projet en cours.'}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => {
                  if (!isAdmin) {
                    setReadOnlyInfo('Lecture seule : demande un rôle admin pour créer un projet.');
                    return;
                  }
                  setCreateOpen(true);
                }}
                disabled={!isAdmin}
              >
                Créer un projet
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--accent)]"
                  checked={allSelected(projects.map((p) => p.id))}
                  ref={(el) => {
                    if (!el) return;
                    el.indeterminate = someSelected(projects.map((p) => p.id)) && !allSelected(projects.map((p) => p.id));
                  }}
                  onChange={() => toggleAll(projects.map((p) => p.id))}
                />
                Sélectionner tout
              </label>
              {selectedCount > 0 ? (
                <BulkActionBar
                  count={selectedCount}
                  onClear={clear}
                  actions={
                    archivedFilter === 'true'
                      ? [
                          {
                            label: bulkLoading ? 'Restauration…' : 'Restaurer',
                            onClick: () => handleBulkRestore(selectedArray),
                            disabled: bulkLoading || !isAdmin,
                          },
                          {
                            label: bulkLoading ? 'Suppression…' : 'Supprimer définitivement',
                            onClick: () => handleBulkDelete(selectedArray),
                            variant: 'danger',
                            disabled: bulkLoading || !isAdmin,
                          },
                        ]
                      : [
                          {
                            label: bulkLoading ? 'Archivage…' : 'Archiver',
                            onClick: () => handleBulkArchive(selectedArray),
                            disabled: bulkLoading || !isAdmin,
                          },
                        ]
                  }
                />
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {projects.map((project) => {
                const detailUrl = `/app/pro/${businessId}/projects/${project.id}`;
                const progressPct = project.progress ?? project.tasksSummary?.progressPct ?? 0;
                const tasksTotal = project.tasksSummary?.total ?? 0;
                const tasksDone = project.tasksSummary?.done ?? 0;
                return (
                  <div
                    key={project.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(detailUrl)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        router.push(detailUrl);
                      }
                    }}
                    className="relative card-interactive rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
                  >
                    <div className="absolute left-3 top-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--accent)]"
                        checked={isSelected(project.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggle(project.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Sélectionner"
                      />
                    </div>
                    <div className="absolute right-3 top-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId((prev) => (prev === project.id ? null : project.id));
                        }}
                        aria-label="Menu projet"
                      >
                        ⋯
                      </Button>
                      {openMenuId === project.id ? (
                        <div
                          className="absolute right-0 z-10 mt-2 w-44 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-md"
                          onClick={(e) => e.stopPropagation()}
                          onMouseLeave={() => setOpenMenuId(null)}
                        >
                          <button
                            className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface-hover)]"
                            onClick={() => {
                              setOpenMenuId(null);
                              openEdit(project);
                            }}
                            disabled={!isAdmin}
                          >
                            Modifier
                          </button>
                          <button
                            className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface-hover)]"
                            onClick={() => {
                              setOpenMenuId(null);
                              router.push(detailUrl);
                            }}
                          >
                            Ouvrir
                          </button>
                          <button
                            className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface-hover)]"
                            onClick={() => {
                              setOpenMenuId(null);
                              router.push(`/app/pro/${businessId}/tasks?projectId=${project.id}`);
                            }}
                          >
                            Voir tâches
                          </button>
                          <button
                            className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface-hover)]"
                            onClick={() => {
                              setOpenMenuId(null);
                              router.push(`/app/pro/${businessId}/finances`);
                            }}
                          >
                            Voir facturation
                          </button>
                          {archivedFilter === 'true' ? (
                            <>
                              <button
                                className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface-hover)]"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  handleRestore(project.id);
                                }}
                              >
                                Restaurer
                              </button>
                              <button
                                className="w-full px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setDeleting(project);
                                }}
                              >
                                Supprimer définitivement
                              </button>
                            </>
                          ) : (
                            <button
                              className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface-hover)]"
                              onClick={() => {
                                setOpenMenuId(null);
                                handleArchive(project.id);
                              }}
                            >
                              Archiver
                            </button>
                          )}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-3 pt-4">
                      <div className="flex items-center gap-2 pr-10">
                        <div className="font-semibold text-[var(--text-primary)]">{project.name}</div>
                        <Badge variant="neutral">{statusLabel(project.status)}</Badge>
                        {project.archivedAt ? <Badge variant="neutral">Archivé</Badge> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <FaviconAvatar name={project.clientName ?? 'Client'} size={32} />
                        <div className="text-sm text-[var(--text-secondary)]">
                          {project.clientName ?? 'Client anonymisé ou non assigné'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                          <span>Progression tâches</span>
                          <span>{tasksDone}/{tasksTotal}</span>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--surface-2)]">
                          <div
                            className="h-2 rounded-full bg-[var(--accent)] transition-all"
                            style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-[var(--text-secondary)] sm:grid-cols-4">
                        <div className="rounded-lg bg-[var(--surface-2)] px-3 py-2">
                          <p className="font-semibold text-[var(--text-primary)]">{project.tasksSummary?.total ?? 0}</p>
                          <p>Tâches</p>
                        </div>
                        <div className="rounded-lg bg-[var(--surface-2)] px-3 py-2">
                          <p className="font-semibold text-[var(--text-primary)]">—</p>
                          <p>Services</p>
                        </div>
                        <div className="rounded-lg bg-[var(--surface-2)] px-3 py-2">
                          <p className="font-semibold text-[var(--text-primary)]">—</p>
                          <p>Devis</p>
                        </div>
                        <div className="rounded-lg bg-[var(--surface-2)] px-3 py-2">
                          <p className="font-semibold text-[var(--text-primary)]">—</p>
                          <p>Factures</p>
                        </div>
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        Dernière activité : {formatDate(project.updatedAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <Modal
        open={createOpen}
        onCloseAction={closeModal}
        title={editing ? 'Modifier le projet' : 'Nouveau projet'}
        description="Associe un client (optionnel) et fixe le statut."
      >
        <form onSubmit={editing ? handleUpdate : handleCreate} className="space-y-4">
          <Input
            label="Nom du projet *"
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            error={createError ?? undefined}
            placeholder="Site web, mission récurrente..."
          />

          <Input
            label="Client ID (optionnel)"
            value={clientId}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setClientId(e.target.value)}
            placeholder="Identifiant client"
          />

          <div className="grid gap-3 md:grid-cols-2">
            <Select
              label="Statut"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            <Input
              label="Début (optionnel)"
              type="date"
              value={startDate}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
            />
          <Input
            label="Fin (optionnel)"
            type="date"
            value={endDate}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
          />
        </div>

          <ReferencePicker
            businessId={businessId}
            categoryId={categoryReferenceId || null}
            tagIds={tagReferenceIds}
            onCategoryChange={(id) => setCategoryReferenceId(id || '')}
            onTagsChange={(ids) => setTagReferenceIds(ids)}
            disabled={!isAdmin}
            title="Références"
          />

          {!isAdmin ? (
            <p className="text-xs text-[var(--text-secondary)]">
              Lecture seule : rôle ADMIN/OWNER requis pour créer ou modifier un projet.
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setCreateOpen(false)} disabled={creating}>
              Annuler
            </Button>
            <Button type="submit" disabled={creating || !isAdmin}>
              {creating ? (editing ? 'Mise à jour…' : 'Création…') : editing ? 'Mettre à jour' : 'Créer'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!deleting}
        onCloseAction={() => setDeleting(null)}
        title="Supprimer ce projet ?"
        description={deleting ? `« ${deleting.name} » sera supprimé.` : undefined}
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Action définitive. Les données liées seront supprimées.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Annuler
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={!isAdmin}>
              Supprimer
            </Button>
          </div>
          {actionError ? <p className="text-xs text-rose-500">{actionError}</p> : null}
          {success ? <p className="text-xs text-emerald-500">{success}</p> : null}
        </div>
      </Modal>
    </div>
  );
}
