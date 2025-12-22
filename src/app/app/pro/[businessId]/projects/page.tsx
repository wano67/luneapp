// src/app/app/pro/[businessId]/projects/page.tsx
'use client';

import Link from 'next/link';
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

const QUOTE_LABELS: Record<ProjectQuoteStatus, string> = {
  DRAFT: 'Devis brouillon',
  SENT: 'Devis envoyé',
  ACCEPTED: 'Devis accepté',
  SIGNED: 'Devis signé',
};

const DEPOSIT_LABELS: Record<ProjectDepositStatus, string> = {
  NOT_REQUIRED: 'Acompte non requis',
  PENDING: 'Acompte en attente',
  PAID: 'Acompte payé',
};

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

  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [categoryOptions, setCategoryOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [tagOptions, setTagOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [referenceRequestId, setReferenceRequestId] = useState<string | null>(null);
  const [archivedFilter, setArchivedFilter] = useState<'all' | 'true' | 'false'>('false');

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
  const { selectedArray, selectedCount, toggle, toggleAll, clear, isSelected } = useRowSelection();

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
      if (statusFilter !== 'ALL') query.set('status', statusFilter);
      if (archivedFilter !== 'all') query.set('archived', archivedFilter);
      if (categoryFilter) query.set('categoryReferenceId', categoryFilter);
      if (tagFilter) query.set('tagReferenceId', tagFilter);

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

      setProjects(res.data.items.map((item) => ({ ...item, tagReferences: item.tagReferences ?? [] })));
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
  }, [businessId, statusFilter, archivedFilter, categoryFilter, tagFilter]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadRefs() {
      setReferenceError(null);
      setReferenceRequestId(null);
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
      setReferenceRequestId(catRes.requestId || tagRes.requestId || null);
      if (!catRes.ok || !tagRes.ok || !catRes.data || !tagRes.data) {
        const msg = catRes.error || tagRes.error || 'Impossible de charger les références.';
        setReferenceError(catRes.requestId || tagRes.requestId ? `${msg} (Ref: ${catRes.requestId || tagRes.requestId})` : msg);
        return;
      }
      setCategoryOptions(catRes.data.items);
      setTagOptions(tagRes.data.items);
    }
    void loadRefs();
    return () => controller.abort();
  }, [businessId]);

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

  async function handleBulkDelete(ids: string[]) {
    if (!ids.length) return;
    if (!isAdmin) {
      setReadOnlyInfo('Lecture seule : suppression réservée aux admins.');
      return;
    }
    const ok = window.confirm(ids.length === 1 ? 'Supprimer ce projet ?' : `Supprimer ${ids.length} projets ?`);
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
    <div className="space-y-5">
      <RoleBanner role={activeCtx?.activeBusiness?.role} />
      <Card className="space-y-3 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
              Projets
            </p>
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">Portefeuille projets</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Suis l’avancement et crée de nouveaux projets clients.
            </p>
          </div>
          <div className="flex flex-col items-start gap-1">
            <Button
              onClick={() => {
                if (!isAdmin) {
                  setReadOnlyInfo('Lecture seule : demande un rôle admin pour créer ou modifier des projets.');
                  return;
                }
                setCreateOpen(true);
              }}
              disabled={!isAdmin}
            >
              Nouveau projet
            </Button>
            {!isAdmin ? (
              <p className="text-[11px] text-[var(--text-secondary)]">Lecture seule : création réservée aux admins.</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[{ value: 'ALL', label: 'Tous' }, ...STATUS_OPTIONS].map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant="outline"
              onClick={() => setStatusFilter(opt.value as ProjectStatus | 'ALL')}
            >
              {opt.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { value: 'false', label: 'Actifs' },
            { value: 'true', label: 'Archivés' },
            { value: 'all', label: 'Tous' },
          ].map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={archivedFilter === opt.value ? 'primary' : 'outline'}
              onClick={() => setArchivedFilter(opt.value as 'all' | 'true' | 'false')}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Projets</p>
          <Button asChild size="sm" variant="outline">
            <Link href={`/app/pro/${businessId}/services`}>Catalogue de services</Link>
          </Button>
        </div>
        {success ? <p className="text-xs font-semibold text-emerald-500">{success}</p> : null}
        {readOnlyInfo ? <p className="text-xs text-[var(--text-secondary)]">{readOnlyInfo}</p> : null}
        <div className="grid gap-3 md:grid-cols-3 pb-3">
          <Select
            label="Catégorie"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">Toutes</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select label="Tag" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
            <option value="">Tous</option>
            {tagOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          {referenceError ? (
            <p className="text-xs text-rose-500">
              {referenceError}
              {referenceRequestId ? ` (Ref: ${referenceRequestId})` : ''}
            </p>
          ) : referenceRequestId ? (
            <p className="text-[10px] text-[var(--text-secondary)]">Refs Req: {referenceRequestId}</p>
          ) : null}
        </div>
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
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">
              Aucun projet pour le moment. Crée ton premier projet.
            </p>
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
        ) : (
          <div className="space-y-3">
            {bulkError ? <p className="text-xs font-semibold text-rose-500">{bulkError}</p> : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--accent)]"
                  checked={projects.length > 0 && projects.every((p) => isSelected(p.id))}
                  onChange={() => toggleAll(projects.map((p) => p.id))}
                />
                Tout sélectionner
              </label>
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
            </div>
            {projects.map((project) => {
              const detailUrl = `/app/pro/${businessId}/projects/${project.id}`;
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
                  className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-3 transition hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-[var(--accent)]"
                      checked={isSelected(project.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggle(project.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Sélectionner"
                    />
                    <div className="space-y-1">
                      <div className="font-semibold text-[var(--text-primary)]">{project.name}</div>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Client : {project.clientName ?? 'Non assigné'}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {project.categoryReferenceName ? (
                          <Badge variant="neutral" className="bg-indigo-50 text-indigo-700">
                            {project.categoryReferenceName}
                          </Badge>
                        ) : null}
                        {project.tagReferences?.map((tag) => (
                          <Badge key={tag.id} variant="neutral" className="bg-emerald-50 text-emerald-700">
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-[10px] text-[var(--text-secondary)]">
                        {formatDate(project.startDate)} → {formatDate(project.endDate)}
                      </p>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        Avancement : {project.progress ?? project.tasksSummary?.progressPct ?? 0}%
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="neutral">{statusLabel(project.status)}</Badge>
                    <Badge variant="neutral">{QUOTE_LABELS[project.quoteStatus]}</Badge>
                    <Badge variant="neutral">{DEPOSIT_LABELS[project.depositStatus]}</Badge>
                    {project.archivedAt ? <Badge variant="neutral">Archivé</Badge> : null}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(project);
                      }}
                      disabled={!isAdmin}
                    >
                      Modifier
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isAdmin) {
                          setReadOnlyInfo('Lecture seule : suppression réservée aux admins.');
                          return;
                        }
                        setDeleting(project);
                      }}
                      disabled={!isAdmin}
                    >
                      Supprimer
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

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
