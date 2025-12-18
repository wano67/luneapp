// src/app/app/pro/[businessId]/projects/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent, type ChangeEvent } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { useActiveBusiness } from '../../ActiveBusinessProvider';

type ProjectStatus = 'PLANNED' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
type ProjectQuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'SIGNED';
type ProjectDepositStatus = 'NOT_REQUIRED' | 'PENDING' | 'PAID';

type Project = {
  id: string;
  businessId: string;
  clientId: string | null;
  clientName: string | null;
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
  const activeCtx = useActiveBusiness({ optional: true });
  const isAdmin = activeCtx?.activeBusiness?.role === 'ADMIN' || activeCtx?.activeBusiness?.role === 'OWNER';

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'ALL'>('ALL');
  const [archivedFilter, setArchivedFilter] = useState<'all' | 'true' | 'false'>('false');

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('PLANNED');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);

  const fetchController = useRef<AbortController | null>(null);

  function resetForm() {
    setName('');
    setClientId('');
    setStatus('PLANNED');
    setStartDate('');
    setEndDate('');
    setCreateError(null);
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

      setProjects(res.data.items);
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
  }, [businessId, statusFilter, archivedFilter]);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
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

      setName('');
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
    setEditing(project);
    setName(project.name);
    setClientId(project.clientId ?? '');
    setStatus(project.status);
    setStartDate(project.startDate ? project.startDate.slice(0, 10) : '');
    setEndDate(project.endDate ? project.endDate.slice(0, 10) : '');
    setCreateError(null);
    setSuccess(null);
    setActionError(null);
    setCreateOpen(true);
  }

  async function handleUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
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

  return (
    <div className="space-y-5">
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
          {isAdmin ? (
            <Button onClick={() => setCreateOpen(true)}>Nouveau projet</Button>
          ) : null}
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
            {isAdmin ? (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                Créer un projet
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map((project) => (
              <div
                key={project.id}
                className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <Link
                      href={`/app/pro/${businessId}/projects/${project.id}`}
                      className="font-semibold text-[var(--text-primary)] hover:underline"
                  >
                    {project.name}
                  </Link>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Client : {project.clientName ?? 'Non assigné'}
                  </p>
                  <p className="text-[10px] text-[var(--text-secondary)]">
                    {formatDate(project.startDate)} → {formatDate(project.endDate)}
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Avancement : {project.progress ?? project.tasksSummary?.progressPct ?? 0}%
                  </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="neutral">{statusLabel(project.status)}</Badge>
                    <Badge variant="neutral">{QUOTE_LABELS[project.quoteStatus]}</Badge>
                    <Badge variant="neutral">{DEPOSIT_LABELS[project.depositStatus]}</Badge>
                    {project.archivedAt ? <Badge variant="neutral">Archivé</Badge> : null}
                    {isAdmin ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => openEdit(project)}>
                          Modifier
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeleting(project)}
                        >
                          Supprimer
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
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

          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setCreateOpen(false)} disabled={creating}>
              Annuler
            </Button>
            <Button type="submit" disabled={creating}>
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
            <Button variant="danger" onClick={confirmDelete}>
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
