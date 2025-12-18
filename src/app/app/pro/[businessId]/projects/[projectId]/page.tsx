// src/app/app/pro/[businessId]/projects/[projectId]/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { useActiveBusiness } from '../../../ActiveBusinessProvider';

type ProjectStatus = 'PLANNED' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
type ProjectQuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'SIGNED';
type ProjectDepositStatus = 'NOT_REQUIRED' | 'PENDING' | 'PAID';
type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
type TaskPhase = 'CADRAGE' | 'UX' | 'DESIGN' | 'DEV' | 'SEO' | 'LAUNCH' | 'FOLLOW_UP' | null;

type ProjectServiceItem = {
  id: string;
  projectId: string;
  serviceId: string;
  quantity: number;
  priceCents: string | null;
  notes: string | null;
  createdAt: string;
  service: { id: string; code: string; name: string; type: string | null; defaultPriceCents?: string | null };
};

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
  counts?: { tasks: number; projectServices: number; interactions: number };
  projectServices?: ProjectServiceItem[];
  tasksSummary?: { total: number; open: number; done: number; progressPct: number };
  createdAt: string;
  updatedAt: string;
};

type ProjectDetailResponse = { item: Project };

type TaskItem = {
  id: string;
  projectId: string | null;
  title: string;
  phase: TaskPhase;
  status: TaskStatus;
  progress: number;
  dueDate: string | null;
  completedAt: string | null;
  assigneeUserId: string | null;
  assigneeEmail: string | null;
  assigneeName: string | null;
};

type ServiceOption = { id: string; code: string; name: string; type: string | null; defaultPriceCents?: string | null };

const STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNED: 'Planifié',
  ACTIVE: 'En cours',
  ON_HOLD: 'Pause',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulé',
};

const QUOTE_LABELS: Record<ProjectQuoteStatus, string> = {
  DRAFT: 'Brouillon',
  SENT: 'Envoyé',
  ACCEPTED: 'Accepté',
  SIGNED: 'Signé',
};

const DEPOSIT_LABELS: Record<ProjectDepositStatus, string> = {
  NOT_REQUIRED: 'Non requis',
  PENDING: 'En attente',
  PAID: 'Payé',
};

const TASK_STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'TODO', label: 'À faire' },
  { value: 'IN_PROGRESS', label: 'En cours' },
  { value: 'DONE', label: 'Terminé' },
];

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return value;
  }
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(
    amount
  );
}

function computeProgress(summary?: Project['tasksSummary'], tasks?: TaskItem[]) {
  if (summary) return summary;
  if (!tasks || tasks.length === 0) return { total: 0, open: 0, done: 0, progressPct: 0 };
  let total = 0;
  let open = 0;
  let done = 0;
  let sum = 0;
  for (const t of tasks) {
    total += 1;
    const pct = t.status === 'DONE' ? 100 : t.status === 'IN_PROGRESS' ? t.progress ?? 0 : 0;
    sum += pct;
    if (t.status === 'DONE') done += 1;
    else open += 1;
  }
  return { total, open, done, progressPct: Math.round(sum / total) };
}

function phaseLabel(phase: TaskPhase) {
  switch (phase) {
    case 'CADRAGE':
      return 'Cadrage';
    case 'UX':
      return 'UX';
    case 'DESIGN':
      return 'Design';
    case 'DEV':
      return 'Dev';
    case 'SEO':
      return 'SEO';
    case 'LAUNCH':
      return 'Lancement';
    case 'FOLLOW_UP':
      return 'Suivi';
    default:
      return 'Sans phase';
  }
}

export default function ProjectDetailPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const projectId = (params?.projectId ?? '') as string;
  const activeCtx = useActiveBusiness({ optional: true });
  const isAdmin = activeCtx?.activeBusiness?.role === 'OWNER' || activeCtx?.activeBusiness?.role === 'ADMIN';

  const [project, setProject] = useState<Project | null>(null);
  const [services, setServices] = useState<ProjectServiceItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [serviceOptions, setServiceOptions] = useState<ServiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ProjectServiceItem | null>(null);
  const [serviceId, setServiceId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [priceCents, setPriceCents] = useState('');
  const [notes, setNotes] = useState('');
  const [savingService, setSavingService] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);

  const [startLoading, setStartLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [taskActionId, setTaskActionId] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);

  const [quoteStatusValue, setQuoteStatusValue] = useState<ProjectQuoteStatus>('DRAFT');
  const [depositStatusValue, setDepositStatusValue] = useState<ProjectDepositStatus>('PENDING');
  const [savingCommercial, setSavingCommercial] = useState(false);
  const [commercialMessage, setCommercialMessage] = useState<string | null>(null);

  function resetServiceForm() {
    setEditingService(null);
    setServiceId('');
    setQuantity(1);
    setPriceCents('');
    setNotes('');
    setServiceError(null);
  }

  async function loadProject(signal?: AbortSignal) {
    const controller = signal ? null : new AbortController();
    const effectiveSignal = signal ?? controller?.signal;
    if (controller) {
      controllerRef.current?.abort();
      controllerRef.current = controller;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetchJson<ProjectDetailResponse>(
        `/api/pro/businesses/${businessId}/projects/${projectId}`,
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
        const msg = res.error ?? 'Projet introuvable.';
        setError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
        setProject(null);
        setServices([]);
        return;
      }
      setRequestId(res.requestId ?? null);
      setProject(res.data.item);
      setServices(res.data.item.projectServices ?? []);
      setQuoteStatusValue(res.data.item.quoteStatus);
      setDepositStatusValue(res.data.item.depositStatus);
    } catch (err) {
      if (effectiveSignal?.aborted) return;
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      if (!effectiveSignal?.aborted) setLoading(false);
    }
  }

  async function loadTasks() {
    try {
      setTasksLoading(true);
      const res = await fetchJson<{ items: TaskItem[] }>(
        `/api/pro/businesses/${businessId}/tasks?projectId=${projectId}`
      );
      if (res.status === 401) {
        const from = window.location.pathname + window.location.search;
        window.location.href = `/login?from=${encodeURIComponent(from)}`;
        return;
      }
      if (!res.ok || !res.data) {
        setTaskError(res.requestId ? `${res.error ?? 'Impossible de charger les tâches.'} (Ref: ${res.requestId})` : res.error ?? 'Impossible de charger les tâches.');
        setTasks([]);
        return;
      }
      setTasks(res.data.items);
      setTaskError(null);
    } catch (err) {
      console.error(err);
      setTaskError(getErrorMessage(err));
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }

  useEffect(() => {
    void loadProject();
    void loadTasks();
    return () => controllerRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, projectId]);

  const progress = useMemo(() => computeProgress(project?.tasksSummary, tasks), [project, tasks]);

  const servicesTotal = useMemo(() => {
    return services.reduce((acc, s) => {
      const unit = s.priceCents ? Number(s.priceCents) : s.service.defaultPriceCents ? Number(s.service.defaultPriceCents) : 0;
      return acc + unit * s.quantity;
    }, 0);
  }, [services]);

  async function openServiceModal(existing?: ProjectServiceItem) {
    if (!serviceOptions.length) {
      const res = await fetchJson<{ items: ServiceOption[] }>(
        `/api/pro/businesses/${businessId}/services`
      );
      if (res.ok && res.data) setServiceOptions(res.data.items);
    }
    if (existing) {
      setEditingService(existing);
      setServiceId(existing.serviceId);
      setQuantity(existing.quantity);
      setPriceCents(existing.priceCents ?? '');
      setNotes(existing.notes ?? '');
    } else {
      resetServiceForm();
    }
    setServiceModalOpen(true);
  }

  async function submitService(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!serviceId) {
      setServiceError('Choisis un service.');
      return;
    }
    setSavingService(true);
    setServiceError(null);
    setActionMessage(null);
    const payload = {
      serviceId,
      quantity,
      priceCents: priceCents ? Number(priceCents) : undefined,
      notes: notes.trim() || undefined,
    };
    try {
      const url = editingService
        ? `/api/pro/businesses/${businessId}/projects/${projectId}/services/${editingService.id}`
        : `/api/pro/businesses/${businessId}/projects/${projectId}/services`;
      const method = editingService ? 'PATCH' : 'POST';
      const res = await fetchJson<ProjectServiceItem>(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok || !res.data) {
        setServiceError(
          res.requestId ? `${res.error ?? 'Action impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Action impossible.'
        );
        return;
      }
      setServiceModalOpen(false);
      resetServiceForm();
      setActionMessage(editingService ? 'Service mis à jour.' : 'Service ajouté.');
      await loadProject();
    } catch (err) {
      setServiceError(getErrorMessage(err));
    } finally {
      setSavingService(false);
    }
  }

  async function deleteService(item: ProjectServiceItem) {
    if (!window.confirm(`Supprimer ${item.service.code} ?`)) return;
    setActionMessage(null);
    const res = await fetchJson<{ ok: boolean }>(
      `/api/pro/businesses/${businessId}/projects/${projectId}/services/${item.id}`,
      { method: 'DELETE' }
    );
    if (!res.ok) {
      setActionMessage(
        res.requestId ? `${res.error ?? 'Suppression impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Suppression impossible.'
      );
      return;
    }
    setActionMessage('Service supprimé.');
    await loadProject();
  }

  async function startProject() {
    if (!project || project.startedAt) return;
    setStartLoading(true);
    setActionMessage(null);
    const res = await fetchJson<{ startedAt: string; tasksCreated: number }>(
      `/api/pro/businesses/${businessId}/projects/${projectId}/start`,
      { method: 'POST' }
    );
    if (!res.ok) {
      setActionMessage(
        res.requestId ? `${res.error ?? 'Démarrage impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Démarrage impossible.'
      );
    } else {
      setActionMessage('Projet démarré.');
      await loadProject();
      await loadTasks();
    }
    setStartLoading(false);
  }

  async function updateTask(task: TaskItem, updates: Partial<TaskItem>) {
    if (!isAdmin) return;
    setTaskActionId(task.id);
    setTaskError(null);
    const res = await fetchJson<TaskItem>(`/api/pro/businesses/${businessId}/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: updates.status ?? task.status,
        progress: updates.progress ?? task.progress,
        dueDate: updates.dueDate ?? task.dueDate,
      }),
    });
    if (!res.ok) {
      setTaskError(
        res.requestId ? `${res.error ?? 'Mise à jour impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Mise à jour impossible.'
      );
    } else {
      await loadTasks();
      await loadProject();
    }
    setTaskActionId(null);
  }

  async function saveCommercial() {
    if (!project || !isAdmin) return;
    setSavingCommercial(true);
    setCommercialMessage(null);
    const res = await fetchJson<ProjectDetailResponse>(
      `/api/pro/businesses/${businessId}/projects/${projectId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteStatus: quoteStatusValue,
          depositStatus: depositStatusValue,
        }),
      }
    );
    if (!res.ok || !res.data) {
      setCommercialMessage(
        res.requestId ? `${res.error ?? 'Enregistrement impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Enregistrement impossible.'
      );
    } else {
      setCommercialMessage('Statuts mis à jour.');
      setProject(res.data.item);
    }
    setSavingCommercial(false);
  }

  if (loading) {
    return (
      <Card className="p-5">
        <p className="text-sm text-[var(--text-secondary)]">Chargement du projet…</p>
      </Card>
    );
  }

  if (!project) {
    return (
      <Card className="space-y-2 p-5">
        <p className="text-sm font-semibold text-rose-400">{error ?? 'Projet introuvable.'}</p>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/app/pro/${businessId}/projects`}>Retour à la liste</Link>
        </Button>
      </Card>
    );
  }

  const canStart =
    !project.startedAt &&
    (project.quoteStatus === 'SIGNED' || project.quoteStatus === 'ACCEPTED') &&
    (project.depositStatus === 'PAID' || project.depositStatus === 'NOT_REQUIRED');

  return (
    <div className="space-y-5">
      <Card className="space-y-3 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
              Projet · Pilotage
            </p>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">{project.name}</h1>
            <p className="text-sm text-[var(--text-secondary)]">Client : {project.clientName ?? 'Non assigné'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">{STATUS_LABELS[project.status]}</Badge>
            <Badge variant="neutral">Devis {QUOTE_LABELS[project.quoteStatus]}</Badge>
            <Badge variant="neutral">Acompte {DEPOSIT_LABELS[project.depositStatus]}</Badge>
            {project.startedAt ? <Badge variant="neutral">Démarré {formatDate(project.startedAt)}</Badge> : null}
            <Badge variant="neutral">ID {project.id}</Badge>
            {requestId ? <Badge variant="neutral">Ref {requestId}</Badge> : null}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Début</p>
            <p className="text-sm text-[var(--text-primary)]">{formatDate(project.startDate)}</p>
          </Card>
          <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Échéance</p>
            <p className="text-sm text-[var(--text-primary)]">{formatDate(project.endDate)}</p>
          </Card>
          <Card className="border-dashed border-[var(--border)] bg-transparent p-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span>Avancement</span>
              <span className="font-semibold text-[var(--text-primary)]">{progress.progressPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--surface)]">
              <div
                className="h-2 rounded-full bg-blue-500 transition-all"
                style={{ width: `${progress.progressPct}%` }}
              />
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">
              {progress.done} terminée(s) · {progress.open} ouverte(s)
            </p>
          </Card>
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Validation commerciale</p>
            <p className="text-xs text-[var(--text-secondary)]">
              Met à jour le statut du devis et de l’acompte pour débloquer le démarrage.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={saveCommercial} disabled={!isAdmin || savingCommercial}>
            {savingCommercial ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Select
            label="Statut du devis"
            value={quoteStatusValue}
            onChange={(e) => setQuoteStatusValue(e.target.value as ProjectQuoteStatus)}
            disabled={!isAdmin || savingCommercial}
          >
            {Object.entries(QUOTE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            label="Statut de l’acompte"
            value={depositStatusValue}
            onChange={(e) => setDepositStatusValue(e.target.value as ProjectDepositStatus)}
            disabled={!isAdmin || savingCommercial}
          >
            {Object.entries(DEPOSIT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        {!project.startedAt && !canStart ? (
          <p className="text-xs text-amber-600">
            Démarrage bloqué tant que le devis n’est pas SIGNED/ACCEPTED et l’acompte non PAID ou NOT_REQUIRED.
          </p>
        ) : null}
        {commercialMessage ? <p className="text-xs text-[var(--text-secondary)]">{commercialMessage}</p> : null}
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Démarrage du projet</p>
            <p className="text-xs text-[var(--text-secondary)]">
              Devis signé + acompte payé pour lancer le projet et générer les tâches.
            </p>
          </div>
          {project.startedAt ? (
            <Badge variant="neutral">Démarré le {formatDate(project.startedAt)}</Badge>
          ) : (
            <Button onClick={startProject} disabled={!canStart || startLoading || !isAdmin} variant="primary">
              {startLoading ? 'Démarrage…' : 'Démarrer le projet'}
            </Button>
          )}
        </div>
        {!canStart && !project.startedAt ? (
          <p className="text-sm text-amber-600">
            Pré-requis : devis SIGNED/ACCEPTED et acompte PAID ou NOT_REQUIRED.
          </p>
        ) : null}
        {!isAdmin ? (
          <p className="text-xs text-[var(--text-secondary)]">Seuls les admins/owners peuvent démarrer un projet.</p>
        ) : null}
        {actionMessage ? <p className="text-xs text-[var(--text-secondary)]">{actionMessage}</p> : null}
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Services vendus</p>
            <p className="text-xs text-[var(--text-secondary)]">
              Quantités, prix et notes sont synchronisés avec le devis.
            </p>
          </div>
          {isAdmin ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" asChild>
                <Link href={`/app/pro/${businessId}/services`}>Gérer le catalogue</Link>
              </Button>
              <Button size="sm" onClick={() => openServiceModal()} variant="outline">
                Ajouter un service
              </Button>
            </div>
          ) : null}
        </div>

        {services.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Aucun service ajouté.</p>
        ) : (
          <div className="space-y-2">
            {services.map((item) => {
              const unit = item.priceCents ?? item.service.defaultPriceCents ?? null;
              const subtotal = unit ? (Number(unit) * item.quantity) / 100 : 0;
              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)]/70 p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-semibold text-[var(--text-primary)]">
                      {item.service.code} · {item.service.name}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {item.quantity} × {unit ? formatCurrency(Number(unit) / 100) : '—'} · Sous-total {formatCurrency(subtotal)}
                    </p>
                    {item.notes ? <p className="text-xs text-[var(--text-secondary)]">{item.notes}</p> : null}
                  </div>
                  {isAdmin ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openServiceModal(item)}>
                        Éditer
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => deleteService(item)}>
                        Supprimer
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Total services : {formatCurrency(servicesTotal / 100)}
            </p>
          </div>
        )}
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Tâches du projet</p>
            <p className="text-xs text-[var(--text-secondary)]">Groupées par phase. Mises à jour en direct.</p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/app/pro/${businessId}/tasks?projectId=${projectId}`}>Voir dans Tâches</Link>
          </Button>
        </div>
        {taskError ? <p className="text-xs text-rose-500">{taskError}</p> : null}
        {tasksLoading ? (
          <p className="text-sm text-[var(--text-secondary)]">Chargement des tâches…</p>
        ) : tasks.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-[var(--text-secondary)]">Aucune tâche pour ce projet.</p>
            {!project.startedAt && isAdmin ? (
              <Button size="sm" variant="outline" onClick={startProject} disabled={startLoading || !canStart}>
                {startLoading ? 'Démarrage…' : 'Démarrer pour générer les tâches'}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {['CADRAGE', 'UX', 'DESIGN', 'DEV', 'SEO', 'LAUNCH', 'FOLLOW_UP', null].map((phase) => {
              const group = tasks.filter((t) => (t.phase ?? null) === phase);
              if (group.length === 0) return null;
              return (
                <div key={phase ?? 'none'} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                      {phaseLabel(phase as TaskPhase)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {group.map((task) => (
                      <div
                        key={task.id}
                        className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/60 p-3"
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-[var(--text-primary)]">{task.title}</p>
                            <p className="text-[11px] text-[var(--text-secondary)]">
                              Échéance {formatDate(task.dueDate)} · {task.assigneeName ?? task.assigneeEmail ?? 'Non assigné'}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Select
                              value={task.status}
                              onChange={(e) => updateTask(task, { status: e.target.value as TaskStatus })}
                              disabled={!isAdmin || taskActionId === task.id}
                            >
                              {TASK_STATUS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </Select>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={task.progress}
                              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                updateTask(task, { progress: Number(e.target.value) })
                              }
                              disabled={!isAdmin || taskActionId === task.id}
                              className="w-24"
                              aria-label="Progression"
                            />
                            <Input
                              type="date"
                              value={task.dueDate ? task.dueDate.slice(0, 10) : ''}
                              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                updateTask(task, { dueDate: e.target.value || null })
                              }
                              disabled={!isAdmin || taskActionId === task.id}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal
        open={serviceModalOpen}
        onCloseAction={() => {
          if (savingService) return;
          setServiceModalOpen(false);
          resetServiceForm();
        }}
        title={editingService ? 'Modifier le service' : 'Ajouter un service'}
        description="Sélectionne un service du catalogue."
      >
        <form onSubmit={submitService} className="space-y-3">
          <Select
            label="Service"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            disabled={savingService}
          >
            <option value="">— Choisir —</option>
            {serviceOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.code} · {opt.name}
              </option>
            ))}
          </Select>
          <Input
            label="Quantité"
            type="number"
            min={1}
            value={quantity}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setQuantity(Math.max(1, Number(e.target.value)))}
            disabled={savingService}
          />
          <Input
            label="Prix unitaire (centimes) — optionnel"
            type="number"
            min={0}
            value={priceCents}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPriceCents(e.target.value)}
            disabled={savingService}
          />
          <label className="flex w-full flex-col gap-1">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Notes</span>
            <textarea
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-faint)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={savingService}
              rows={3}
            />
          </label>
          {serviceError ? <p className="text-xs text-rose-500">{serviceError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setServiceModalOpen(false)} disabled={savingService}>
              Annuler
            </Button>
            <Button type="submit" disabled={savingService}>
              {savingService ? 'Enregistrement…' : editingService ? 'Mettre à jour' : 'Ajouter'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
