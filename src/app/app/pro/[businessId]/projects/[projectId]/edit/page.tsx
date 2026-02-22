'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { useClientsLite } from '@/lib/hooks/useClientsLite';
import { ProjectStatus } from '@/generated/prisma';
import { getProjectScopeLabelFR, getProjectStatusLabelFR } from '@/lib/projectStatusUi';
import { useActiveBusiness } from '../../../../ActiveBusinessProvider';
import { ReferencePicker } from '../../../references/ReferencePicker';

type ProjectItem = {
  id: string;
  name: string;
  status: ProjectStatus;
  clientId: string | null;
  clientName: string | null;
  startDate: string | null;
  endDate: string | null;
  startedAt: string | null;
  archivedAt: string | null;
  categoryReferenceId?: string | null;
  tagReferences?: Array<{ id: string; name: string }>;
};

type ProjectResponse = { item: ProjectItem };

type FormState = {
  name: string;
  status: ProjectStatus;
  clientId: string;
  startDate: string;
  endDate: string;
  categoryReferenceId: string;
  tagReferenceIds: string[];
};

const STATUS_OPTIONS: Array<{ value: ProjectStatus; label: string }> = [
  { value: ProjectStatus.PLANNED, label: 'En attente' },
  { value: ProjectStatus.ACTIVE, label: 'Actif' },
  { value: ProjectStatus.ON_HOLD, label: 'En pause' },
  { value: ProjectStatus.COMPLETED, label: 'Terminé' },
  { value: ProjectStatus.CANCELLED, label: 'Annulé' },
];

function toDateInput(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return value;
  }
}

export default function ProjectEditPage() {
  const router = useRouter();
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const projectId = (params?.projectId ?? '') as string;
  const activeCtx = useActiveBusiness({ optional: true });
  const isAdmin = activeCtx?.isAdmin ?? false;
  const isReadOnly = !isAdmin;
  const [project, setProject] = useState<ProjectItem | null>(null);
  const [form, setForm] = useState<FormState>({
    name: '',
    status: ProjectStatus.PLANNED,
    clientId: '',
    startDate: '',
    endDate: '',
    categoryReferenceId: '',
    tagReferenceIds: [],
  });
  const [clientSearch, setClientSearch] = useState('');
  const clientQuery = isReadOnly ? '' : clientSearch;
  const { data: clients, isLoading: clientsLoading } = useClientsLite(businessId, clientQuery);
  const clientsList = clients ?? [];

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const loadProject = useCallback(async () => {
    if (!businessId || !projectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchJson<ProjectResponse>(
        `/api/pro/businesses/${businessId}/projects/${projectId}`
      );
      if (!res.ok || !res.data) {
        const msg = res.error ?? 'Impossible de charger le projet.';
        setError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
        return;
      }
      const item = res.data.item;
      setProject(item);
      setForm({
        name: item.name ?? '',
        status: item.status ?? ProjectStatus.PLANNED,
        clientId: item.clientId ?? '',
        startDate: toDateInput(item.startDate),
        endDate: toDateInput(item.endDate),
        categoryReferenceId: item.categoryReferenceId ?? '',
        tagReferenceIds: item.tagReferences?.map((t) => t.id) ?? [],
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [businessId, projectId]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  const initialTags = useMemo(() => {
    return (project?.tagReferences ?? []).map((t) => t.id).sort().join('|');
  }, [project]);

  const hasChanges = useMemo(() => {
    if (!project) return false;
    const currentTags = [...form.tagReferenceIds].sort().join('|');
    return (
      form.name.trim() !== (project.name ?? '') ||
      form.status !== project.status ||
      (form.clientId || '') !== (project.clientId ?? '') ||
      form.startDate !== toDateInput(project.startDate) ||
      form.endDate !== toDateInput(project.endDate) ||
      form.categoryReferenceId !== (project.categoryReferenceId ?? '') ||
      currentTags !== initialTags
    );
  }, [form, initialTags, project]);

  const statusScope = useMemo(() => {
    if (!project) return null;
    return getProjectScopeLabelFR(form.status, project.archivedAt);
  }, [form.status, project]);

  const statusLabel = useMemo(() => {
    if (!project) return null;
    return getProjectStatusLabelFR(project.status);
  }, [project]);

  const selectedStatusLabel = useMemo(() => {
    return getProjectStatusLabelFR(form.status);
  }, [form.status]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!project) return;
    setError(null);
    setInfo(null);

    if (!isAdmin) {
      setError('Réservé aux admins/owners.');
      return;
    }

    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setError('Le nom du projet est requis.');
      return;
    }

    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      setError('La fin doit être après le début.');
      return;
    }

    const payload: Record<string, unknown> = {};
    if (trimmedName !== (project.name ?? '')) payload.name = trimmedName;
    if (form.status !== project.status) payload.status = form.status;
    if ((form.clientId || '') !== (project.clientId ?? '')) {
      payload.clientId = form.clientId || null;
    }
    if (form.startDate !== toDateInput(project.startDate)) {
      payload.startDate = form.startDate || null;
    }
    if (form.endDate !== toDateInput(project.endDate)) {
      payload.endDate = form.endDate || null;
    }
    if (form.categoryReferenceId !== (project.categoryReferenceId ?? '')) {
      payload.categoryReferenceId = form.categoryReferenceId || null;
    }
    const currentTags = [...form.tagReferenceIds].sort().join('|');
    if (currentTags !== initialTags) {
      payload.tagReferenceIds = form.tagReferenceIds;
    }

    if (!Object.keys(payload).length) {
      setError('Aucune modification.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetchJson<ProjectResponse>(
        `/api/pro/businesses/${businessId}/projects/${projectId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok || !res.data) {
        const msg = res.error ?? 'Enregistrement impossible.';
        setError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
        return;
      }
      setInfo('Projet mis à jour.');
      router.replace(`/app/pro/${businessId}/projects/${projectId}`);
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveToggle() {
    if (!project) return;
    if (!isAdmin) {
      setError('Réservé aux admins/owners.');
      return;
    }
    const archiving = !project.archivedAt;
    const confirmMessage = archiving
      ? 'Archiver ce projet ? Il sera considéré comme inactif.'
      : 'Désarchiver ce projet ?';
    if (typeof window !== 'undefined' && !window.confirm(confirmMessage)) return;

    setArchiveLoading(true);
    setError(null);
    setInfo(null);
    try {
      const endpoint = archiving ? 'archive' : 'unarchive';
      const res = await fetchJson<{ id: string; archivedAt: string | null }>(
        `/api/pro/businesses/${businessId}/projects/${projectId}/${endpoint}`,
        { method: 'POST' }
      );
      if (!res.ok) {
        const msg = res.error ?? 'Action impossible.';
        setError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
        return;
      }
      setInfo(archiving ? 'Projet archivé.' : 'Projet désarchivé.');
      await loadProject();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setArchiveLoading(false);
    }
  }

  async function handleStartProject() {
    if (!project) return;
    if (!isAdmin) {
      setError('Réservé aux admins/owners.');
      return;
    }
    setStartLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetchJson<{ startedAt: string; tasksCreated: number }>(
        `/api/pro/businesses/${businessId}/projects/${projectId}/start`,
        { method: 'POST' }
      );
      if (!res.ok) {
        const msg = res.error ?? 'Démarrage impossible.';
        setError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
        return;
      }
      const tasksCreated = res.data?.tasksCreated ?? 0;
      setInfo(`Projet démarré. ${tasksCreated} tâche(s) créée(s).`);
      await loadProject();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setStartLoading(false);
    }
  }

  const statusHelper = statusScope ? `Catégorie: ${statusScope}` : null;

  if (loading) {
    return <div className="mx-auto max-w-4xl px-4 py-6">Chargement…</div>;
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <Card className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <p className="text-sm font-semibold text-rose-500">Projet introuvable</p>
          <p className="text-xs text-[var(--text-secondary)]">{error ?? 'Ce projet est indisponible.'}</p>
          <div className="mt-4">
            <Button asChild variant="outline" size="sm">
              <Link href={`/app/pro/${businessId}/projects`}>Retour aux projets</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href={`/app/pro/${businessId}/projects/${projectId}`}>
              <ArrowLeft size={16} />
              Retour
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/app/pro/${businessId}/projects/${projectId}`}>Annuler</Link>
            </Button>
            <Button
              size="sm"
              type="submit"
              form="project-edit-form"
              disabled={saving || !hasChanges || isReadOnly}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              Enregistrer
            </Button>
          </div>
        </div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Modifier le projet</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Statut actuel : {statusLabel ?? project.status} {project.archivedAt ? '· Archivé' : ''}
        </p>
        <p className="text-xs text-[var(--text-secondary)]">
          Statut sélectionné : {selectedStatusLabel}
        </p>
      </div>

      {error ? <p className="text-sm text-rose-500">{error}</p> : null}
      {info ? <p className="text-sm text-emerald-500">{info}</p> : null}
      {isReadOnly ? (
        <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-secondary)]">
          Lecture seule : réservé aux admins/owners.
        </Card>
      ) : null}

      <Card className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <form id="project-edit-form" onSubmit={handleSave} className="space-y-4">
          <Input
            label="Nom du projet"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            disabled={isReadOnly || saving}
            placeholder="Nom du projet"
          />

          <div className="grid gap-3 md:grid-cols-2">
            <Select
              label="Statut"
              value={form.status}
              onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as ProjectStatus }))}
              disabled={isReadOnly || saving}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Input label="Portée" value={statusHelper ?? '—'} disabled helper="Basé sur statut + archivage" />
          </div>

          <div className="space-y-2">
            <Input
              label="Filtrer clients"
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              placeholder="Rechercher un client"
              disabled={clientsLoading || isReadOnly}
            />
            <Select
              label="Client"
              value={form.clientId}
              onChange={(e) => setForm((prev) => ({ ...prev, clientId: e.target.value }))}
              disabled={isReadOnly || saving || clientsLoading}
            >
              <option value="">Aucun client</option>
              {clientsList.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name ?? `Client #${client.id}`}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Date de début"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
              disabled={isReadOnly || saving}
            />
            <Input
              label="Date de fin"
              type="date"
              value={form.endDate}
              onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
              disabled={isReadOnly || saving}
            />
          </div>
        </form>
      </Card>

      <ReferencePicker
        businessId={businessId}
        categoryId={form.categoryReferenceId || null}
        tagIds={form.tagReferenceIds}
        onCategoryChange={(id) => setForm((prev) => ({ ...prev, categoryReferenceId: id ?? '' }))}
        onTagsChange={(ids) => setForm((prev) => ({ ...prev, tagReferenceIds: ids }))}
        disabled={isReadOnly || saving}
        title="Références (catégorie + tags)"
      />

      {isReadOnly ? null : (
        <>
          <Card className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm space-y-3">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Archivage</p>
              <p className="text-xs text-[var(--text-secondary)]">
                {project.archivedAt
                  ? `Archivé le ${formatDate(project.archivedAt)}.`
                  : 'Ce projet est actif (non archivé).'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={project.archivedAt ? 'outline' : 'danger'}
                onClick={handleArchiveToggle}
                disabled={archiveLoading}
              >
                {archiveLoading ? 'Traitement…' : project.archivedAt ? 'Désarchiver' : 'Archiver'}
              </Button>
            </div>
          </Card>

          {project.status === ProjectStatus.ACTIVE && !project.startedAt && !project.archivedAt ? (
            <Card className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm space-y-3">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Démarrage</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Le projet est en statut ACTIVE mais n’a pas été démarré.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleStartProject}
                disabled={startLoading}
              >
                {startLoading ? 'Démarrage…' : 'Démarrer le projet'}
              </Button>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
