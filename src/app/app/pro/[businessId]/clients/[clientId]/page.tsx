// src/app/app/pro/[businessId]/clients/[clientId]/page.tsx
'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { useActiveBusiness } from '../../../ActiveBusinessProvider';
import RoleBanner from '@/components/RoleBanner';
import { ReferencePicker } from '../../references/ReferencePicker';

type Client = {
  id: string;
  businessId: string;
  categoryReferenceId: string | null;
  categoryReferenceName: string | null;
  tagReferences: { id: string; name: string }[];
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type ClientDetailResponse = {
  item: Client;
};

type InteractionType = 'CALL' | 'MEETING' | 'EMAIL' | 'NOTE' | 'MESSAGE';

type Interaction = {
  id: string;
  businessId: string;
  clientId: string | null;
  projectId: string | null;
  type: InteractionType;
  content: string;
  happenedAt: string;
  nextActionDate: string | null;
  createdAt: string;
  createdByUserId: string | null;
};

type ProjectStatus = 'PLANNED' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';

type ProjectSummary = {
  id: string;
  businessId: string;
  clientId: string | null;
  clientName: string | null;
  name: string;
  status: ProjectStatus;
  quoteStatus: 'DRAFT' | 'SENT' | 'SIGNED' | 'CANCELLED' | 'EXPIRED';
  depositStatus: 'NOT_REQUIRED' | 'PENDING' | 'PAID';
  startDate: string | null;
  endDate: string | null;
  startedAt: string | null;
  archivedAt: string | null;
  progress: number;
};

type FinanceLine = {
  id: string;
  businessId: string;
  projectId: string | null;
  projectName: string | null;
  type: 'INCOME' | 'EXPENSE';
  amountCents: string;
  amount: number;
  category: string;
  date: string;
  note: string | null;
};

export default function ClientDetailPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const clientId = (params?.clientId ?? '') as string;
  const activeCtx = useActiveBusiness({ optional: true });
  const role = activeCtx?.activeBusiness?.role;
  const isAdminOrOwner = role === 'ADMIN' || role === 'OWNER';
  const canEditInteractions = isAdminOrOwner;
  const canEditReferences = isAdminOrOwner;

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchController = useRef<AbortController | null>(null);
  const interactionsController = useRef<AbortController | null>(null);
  const projectsController = useRef<AbortController | null>(null);
  const financesController = useRef<AbortController | null>(null);

  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [interactionsLoading, setInteractionsLoading] = useState(true);
  const [interactionsError, setInteractionsError] = useState<string | null>(null);
  const [interactionRequestId, setInteractionRequestId] = useState<string | null>(null);
  const [interactionType, setInteractionType] = useState<InteractionType>('CALL');
  const [interactionContent, setInteractionContent] = useState('');
  const [interactionDate, setInteractionDate] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [interactionNextAction, setInteractionNextAction] = useState('');
  const [savingInteraction, setSavingInteraction] = useState(false);
  const [interactionInfo, setInteractionInfo] = useState<string | null>(null);
  const [editingInteraction, setEditingInteraction] = useState<Interaction | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [projectsRequestId, setProjectsRequestId] = useState<string | null>(null);
  const [financeLines, setFinanceLines] = useState<FinanceLine[]>([]);
  const [financeLoading, setFinanceLoading] = useState(true);
  const [financeError, setFinanceError] = useState<string | null>(null);
  const [financeRequestId, setFinanceRequestId] = useState<string | null>(null);
  const [categoryReferenceId, setCategoryReferenceId] = useState<string>('');
  const [tagReferenceIds, setTagReferenceIds] = useState<string[]>([]);
  const [referenceMessage, setReferenceMessage] = useState<string | null>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [referenceRequestId, setReferenceRequestId] = useState<string | null>(null);
  const [referencesSaving, setReferencesSaving] = useState(false);

  function formatDate(value: string) {
    try {
      return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
    } catch {
      return value;
    }
  }

  function formatDateTime(value: string) {
    try {
      return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
    } catch {
      return value;
    }
  }

  function formatCents(value: string | number | null | undefined, currency = 'EUR') {
    const num = typeof value === 'number' ? value : Number(value ?? 0);
    if (!Number.isFinite(num)) return '—';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
      num / 100
    );
  }

  function interactionTypeLabel(value: InteractionType) {
    switch (value) {
      case 'CALL':
        return 'Appel';
      case 'MEETING':
        return 'Réunion';
      case 'EMAIL':
        return 'Email';
      case 'NOTE':
        return 'Note';
      case 'MESSAGE':
        return 'Message';
      default:
        return value;
    }
  }

  async function loadProjects(signal?: AbortSignal) {
    const controller = signal ? null : new AbortController();
    const effectiveSignal = signal ?? controller?.signal;
    if (controller) {
      projectsController.current?.abort();
      projectsController.current = controller;
    }

    try {
      setProjectsLoading(true);
      setProjectsError(null);
      setProjectsRequestId(null);
      const res = await fetchJson<{ items: ProjectSummary[] }>(
        `/api/pro/businesses/${businessId}/projects?clientId=${clientId}`,
        {},
        effectiveSignal
      );
      if (effectiveSignal?.aborted) return;
      setProjectsRequestId(res.requestId);
      if (!res.ok || !res.data) {
        const msg = res.error ?? 'Impossible de charger les projets.';
        setProjectsError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
        setProjects([]);
        return;
      }
      setProjects(res.data.items);
    } catch (err) {
      if (effectiveSignal?.aborted) return;
      setProjectsError(getErrorMessage(err));
      setProjects([]);
    } finally {
      if (!effectiveSignal?.aborted) setProjectsLoading(false);
    }
  }

  async function loadFinanceLines(signal?: AbortSignal) {
    if (projects.length === 0) {
      setFinanceLines([]);
      setFinanceLoading(false);
      return;
    }
    const controller = signal ? null : new AbortController();
    const effectiveSignal = signal ?? controller?.signal;
    if (controller) {
      financesController.current?.abort();
      financesController.current = controller;
    }
    try {
      setFinanceLoading(true);
      setFinanceError(null);
      setFinanceRequestId(null);
      const res = await fetchJson<{ items: FinanceLine[] }>(
        `/api/pro/businesses/${businessId}/finances`,
        {},
        effectiveSignal
      );
      if (effectiveSignal?.aborted) return;
      setFinanceRequestId(res.requestId);
      if (!res.ok || !res.data) {
        const msg = res.error ?? 'Impossible de charger les finances.';
        setFinanceError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
        setFinanceLines([]);
        return;
      }
      const projectIds = new Set(projects.map((p) => p.id));
      const filtered = res.data.items.filter((line) => line.projectId && projectIds.has(line.projectId));
      setFinanceLines(filtered);
    } catch (err) {
      if (effectiveSignal?.aborted) return;
      setFinanceError(getErrorMessage(err));
      setFinanceLines([]);
    } finally {
      if (!effectiveSignal?.aborted) setFinanceLoading(false);
    }
  }

  async function loadInteractions(signal?: AbortSignal) {
    const controller = signal ? null : new AbortController();
    const effectiveSignal = signal ?? controller?.signal;
    if (controller) {
      interactionsController.current?.abort();
      interactionsController.current = controller;
    }

    try {
      setInteractionsLoading(true);
      setInteractionsError(null);
      setInteractionRequestId(null);

      const res = await fetchJson<{ items: Interaction[] }>(
        `/api/pro/businesses/${businessId}/interactions?clientId=${clientId}&limit=10`,
        {},
        effectiveSignal
      );

      if (effectiveSignal?.aborted) return;
      setInteractionRequestId(res.requestId);

      if (res.status === 401) {
        const from = window.location.pathname + window.location.search;
        window.location.href = `/login?from=${encodeURIComponent(from)}`;
        return;
      }

      if (!res.ok || !res.data) {
        const msg = res.error ?? 'Impossible de charger les interactions.';
        setInteractionsError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
        setInteractions([]);
        return;
      }

      setInteractions(res.data.items);
    } catch (err) {
      if (effectiveSignal?.aborted) return;
      console.error(err);
      setInteractionsError(getErrorMessage(err));
      setInteractions([]);
    } finally {
      if (!effectiveSignal?.aborted) setInteractionsLoading(false);
    }
  }

  function startEditInteraction(interaction: Interaction) {
    setEditingInteraction(interaction);
    setInteractionType(interaction.type);
    setInteractionContent(interaction.content);
    setInteractionDate(interaction.happenedAt.slice(0, 16));
    setInteractionNextAction(interaction.nextActionDate ? interaction.nextActionDate.slice(0, 16) : '');
    setInteractionInfo(null);
    setInteractionsError(null);
  }

  async function deleteInteraction(interaction: Interaction) {
    if (!canEditInteractions) return;
    if (!window.confirm('Supprimer cette interaction ?')) return;
    setInteractionsError(null);
    setInteractionInfo(null);
    const res = await fetchJson<{ ok: boolean }>(
      `/api/pro/businesses/${businessId}/interactions/${interaction.id}`,
      { method: 'DELETE' }
    );
    setInteractionRequestId(res.requestId);
    if (res.status === 401) {
      const from = window.location.pathname + window.location.search;
      window.location.href = `/login?from=${encodeURIComponent(from)}`;
      return;
    }
    if (!res.ok) {
      const msg = res.error ?? 'Suppression impossible.';
      setInteractionsError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      return;
    }
    if (editingInteraction?.id === interaction.id) {
      setEditingInteraction(null);
      setInteractionContent('');
      setInteractionNextAction('');
      setInteractionType('CALL');
      setInteractionDate(new Date().toISOString().slice(0, 16));
    }
    await loadInteractions();
  }

  async function submitInteraction(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEditInteractions) return;
    setSavingInteraction(true);
    setInteractionsError(null);
    setInteractionInfo(null);
    const isEdit = Boolean(editingInteraction);

    const content = interactionContent.trim();
    if (!content) {
      setInteractionsError('Contenu requis.');
      setSavingInteraction(false);
      return;
    }

    const happenedAtValue = interactionDate ? new Date(interactionDate) : new Date();
    if (Number.isNaN(happenedAtValue.getTime())) {
      setInteractionsError('Date invalide.');
      setSavingInteraction(false);
      return;
    }
    const nextActionValue = interactionNextAction ? new Date(interactionNextAction) : null;
    if (nextActionValue && Number.isNaN(nextActionValue.getTime())) {
      setInteractionsError('Prochaine action invalide.');
      setSavingInteraction(false);
      return;
    }

    const payload: Record<string, unknown> = {
      clientId,
      type: interactionType,
      content,
      happenedAt: happenedAtValue.toISOString(),
    };
    if (nextActionValue) payload.nextActionDate = nextActionValue.toISOString();
    else if (isEdit && !interactionNextAction) payload.nextActionDate = null;

    const endpoint = isEdit
      ? `/api/pro/businesses/${businessId}/interactions/${editingInteraction?.id}`
      : `/api/pro/businesses/${businessId}/interactions`;
    const res = await fetchJson<Interaction>(endpoint, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setInteractionRequestId(res.requestId);

    if (res.status === 401) {
      const from = window.location.pathname + window.location.search;
      window.location.href = `/login?from=${encodeURIComponent(from)}`;
      setSavingInteraction(false);
      return;
    }

    if (!res.ok || !res.data) {
      const msg = res.error ?? 'Création impossible.';
      setInteractionsError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      setSavingInteraction(false);
      return;
    }

    setInteractionInfo(isEdit ? 'Interaction mise à jour.' : 'Interaction ajoutée.');
    setEditingInteraction(null);
    setInteractionType('CALL');
    setInteractionContent('');
    setInteractionNextAction('');
    setInteractionDate(new Date().toISOString().slice(0, 16));
    await loadInteractions();
    setSavingInteraction(false);
  }

  async function saveReferences() {
    if (!canEditReferences) return;
    setReferenceError(null);
    setReferenceMessage(null);
    setReferencesSaving(true);
    const res = await fetchJson<ClientDetailResponse>(
      `/api/pro/businesses/${businessId}/clients/${clientId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryReferenceId: categoryReferenceId || null,
          tagReferenceIds,
        }),
      }
    );

    setReferenceRequestId(res.requestId ?? null);

    if (res.status === 401) {
      const from = window.location.pathname + window.location.search;
      window.location.href = `/login?from=${encodeURIComponent(from)}`;
      return;
    }

    if (!res.ok || !res.data) {
      const msg = res.error ?? 'Impossible de mettre à jour les références.';
      setReferenceError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      setReferencesSaving(false);
      return;
    }

    const updated: Client = {
      ...res.data.item,
      categoryReferenceId: res.data.item.categoryReferenceId ?? null,
      categoryReferenceName: res.data.item.categoryReferenceName ?? null,
      tagReferences: res.data.item.tagReferences ?? [],
    };

    setClient(updated);
    setCategoryReferenceId(updated.categoryReferenceId ?? '');
    setTagReferenceIds(updated.tagReferences.map((t) => t.id));
    setReferenceMessage('Références mises à jour.');
    setReferenceError(null);
    setReferencesSaving(false);
  }

  useEffect(() => {
    const controller = new AbortController();
    fetchController.current?.abort();
    fetchController.current = controller;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetchJson<ClientDetailResponse>(
          `/api/pro/businesses/${businessId}/clients/${clientId}`,
          {},
          controller.signal
        );

        if (controller.signal.aborted) return;

        if (res.status === 401) {
          const from = window.location.pathname + window.location.search;
          window.location.href = `/login?from=${encodeURIComponent(from)}`;
          return;
        }

        if (!res.ok || !res.data) {
          const msg = res.error ?? 'Chargement impossible.';
          setError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
          setClient(null);
          return;
        }

        const normalized: Client = {
          ...res.data.item,
          categoryReferenceId: res.data.item.categoryReferenceId ?? null,
          categoryReferenceName: res.data.item.categoryReferenceName ?? null,
          tagReferences: res.data.item.tagReferences ?? [],
        };
        setClient(normalized);
        setCategoryReferenceId(normalized.categoryReferenceId ?? '');
        setTagReferenceIds(normalized.tagReferences.map((t) => t.id));
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error(err);
        setError('Impossible de charger ce client.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    void loadInteractions();
    return () => {
      controller.abort();
      interactionsController.current?.abort();
      projectsController.current?.abort();
      financesController.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, clientId]);

  useEffect(() => {
    void loadProjects();
    return () => projectsController.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, clientId]);

  useEffect(() => {
    void loadFinanceLines();
    return () => financesController.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, businessId]);

  const incomeTotalCents = financeLines
    .filter((f) => f.type === 'INCOME')
    .reduce((acc, f) => acc + Number(f.amountCents ?? 0), 0);
  const expenseTotalCents = financeLines
    .filter((f) => f.type === 'EXPENSE')
    .reduce((acc, f) => acc + Number(f.amountCents ?? 0), 0);

  if (loading) {
    return (
      <Card className="p-5">
        <p className="text-sm text-[var(--text-secondary)]">Chargement du client…</p>
      </Card>
    );
  }

  if (!client) {
    return (
      <Card className="space-y-2 p-5">
        <p className="text-sm font-semibold text-rose-400">{error ?? 'Client introuvable.'}</p>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/app/pro/${businessId}/clients`}>Retour à la liste</Link>
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <RoleBanner role={role} />
      <Card className="space-y-3 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
              Client · Centre de pilotage
            </p>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">{client.name}</h1>
            <p className="text-xs text-[var(--text-secondary)]">Cockpit client — données consolidées.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">ID {client.id}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {client.categoryReferenceName ? (
            <Badge variant="neutral" className="bg-indigo-50 text-indigo-700">
              {client.categoryReferenceName}
            </Badge>
          ) : (
            <Badge variant="neutral">Catégorie ?</Badge>
          )}
          {client.tagReferences.length ? (
            client.tagReferences.map((tag) => (
              <Badge key={tag.id} variant="neutral" className="bg-emerald-50 text-emerald-700">
                {tag.name}
              </Badge>
            ))
          ) : (
            <Badge variant="neutral">Tags ?</Badge>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Card className="space-y-1 border-dashed border-[var(--border)] bg-[var(--surface)]/70 p-3">
            <p className="text-xs font-semibold text-[var(--text-primary)]">Synthèse finances (projets liés)</p>
            <p className="text-sm text-[var(--text-secondary)]">
              Revenus: {formatCents(incomeTotalCents)} · Dépenses: {formatCents(expenseTotalCents)}
            </p>
          </Card>
          <Card className="space-y-1 border-dashed border-[var(--border)] bg-[var(--surface)]/70 p-3">
            <p className="text-xs font-semibold text-[var(--text-primary)]">Créé le</p>
            <p className="text-sm text-[var(--text-secondary)]">{formatDate(client.createdAt)}</p>
          </Card>
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Références</p>
            <p className="text-xs text-[var(--text-secondary)]">Catégorie et tags liés à ce client.</p>
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
          title="Références client"
        />
        {referenceError ? <p className="text-xs font-semibold text-rose-500">{referenceError}</p> : null}
        {referenceMessage ? <p className="text-xs text-emerald-500">{referenceMessage}</p> : null}
        {referenceRequestId ? <p className="text-[10px] text-[var(--text-faint)]">Req: {referenceRequestId}</p> : null}
        <div className="flex justify-end">
          <Button onClick={() => void saveReferences()} disabled={!canEditReferences || referencesSaving}>
            {referencesSaving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Infos générales</p>
          <Badge variant="neutral">Contact</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Email</p>
            <p className="text-sm text-[var(--text-primary)]">{client.email ?? 'Non renseigné'}</p>
          </Card>
          <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Téléphone</p>
            <p className="text-sm text-[var(--text-primary)]">{client.phone ?? 'Non renseigné'}</p>
          </Card>
        </div>
        <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
          <p className="text-xs font-semibold text-[var(--text-secondary)]">Notes</p>
          <p className="text-sm text-[var(--text-primary)]">{client.notes ?? '—'}</p>
        </Card>
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Interactions</p>
            <p className="text-xs text-[var(--text-secondary)]">Les 10 dernières actions + prochaine action à suivre.</p>
          </div>
          <Badge variant="neutral">{canEditInteractions ? 'Écriture autorisée' : 'Lecture seule'}</Badge>
        </div>

        {interactionsError ? <p className="text-xs font-semibold text-rose-500">{interactionsError}</p> : null}

        {interactionsLoading ? (
          <p className="text-sm text-[var(--text-secondary)]">Chargement des interactions…</p>
        ) : interactions.length === 0 ? (
          <Card className="space-y-2 border-dashed border-[var(--border)] bg-transparent p-3">
            <p className="text-sm text-[var(--text-secondary)]">
              Aucune interaction encore. Ajoute un point de contact pour garder l’historique client.
            </p>
            {canEditInteractions ? (
              <Button size="sm" onClick={() => document.getElementById('interaction-content')?.scrollIntoView()}>
                Ajouter une interaction
              </Button>
            ) : null}
          </Card>
        ) : (
          <div className="space-y-2">
            {interactions.map((interaction) => (
              <div
                key={interaction.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/60 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="pro">{interactionTypeLabel(interaction.type)}</Badge>
                    {interaction.nextActionDate ? (
                      <Badge variant="personal">Next {formatDate(interaction.nextActionDate)}</Badge>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)]">{formatDateTime(interaction.happenedAt)}</p>
                </div>
                <p className="text-sm text-[var(--text-primary)]">{interaction.content}</p>
                {canEditInteractions ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => startEditInteraction(interaction)}>
                      Modifier
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteInteraction(interaction)}>
                      Supprimer
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 p-4">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Ajouter une interaction</p>
          <form onSubmit={submitInteraction} className="grid gap-3 md:grid-cols-2">
            <Select
              label="Type"
              value={interactionType}
              onChange={(e) => setInteractionType(e.target.value as InteractionType)}
              disabled={!canEditInteractions || savingInteraction}
            >
              <option value="CALL">Appel</option>
              <option value="MEETING">Réunion</option>
              <option value="EMAIL">Email</option>
              <option value="NOTE">Note</option>
              <option value="MESSAGE">Message</option>
            </Select>
            <Input
              label="Date de l’interaction"
              type="datetime-local"
              value={interactionDate}
              onChange={(e) => setInteractionDate(e.target.value)}
              disabled={!canEditInteractions || savingInteraction}
            />
            <Input
              label="Prochaine action (optionnel)"
              type="datetime-local"
              value={interactionNextAction}
              onChange={(e) => setInteractionNextAction(e.target.value)}
              disabled={!canEditInteractions || savingInteraction}
            />
            <label className="flex w-full flex-col gap-1 md:col-span-2" id="interaction-content">
              <span className="text-sm font-medium text-[var(--text-secondary)]">Contenu</span>
              <textarea
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-faint)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                value={interactionContent}
                onChange={(e) => setInteractionContent(e.target.value)}
                rows={3}
                disabled={!canEditInteractions || savingInteraction}
                placeholder="Compte-rendu, décision, suivi…"
                required
              />
            </label>
            {!canEditInteractions ? (
              <p className="text-xs text-[var(--text-secondary)]">Lecture seule pour les rôles Viewer/Membre.</p>
            ) : null}
            <div className="flex items-center justify-end gap-2 md:col-span-2">
              {interactionInfo ? <span className="text-xs text-emerald-500">{interactionInfo}</span> : null}
              {editingInteraction ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingInteraction(null);
                    setInteractionType('CALL');
                    setInteractionContent('');
                    setInteractionNextAction('');
                    setInteractionDate(new Date().toISOString().slice(0, 16));
                  }}
                  disabled={savingInteraction}
                >
                  Annuler l’édition
                </Button>
              ) : null}
              <Button type="submit" disabled={!canEditInteractions || savingInteraction}>
                {savingInteraction ? 'Enregistrement…' : editingInteraction ? 'Mettre à jour' : 'Ajouter une interaction'}
              </Button>
            </div>
          </form>
        </div>

        {interactionRequestId ? (
          <p className="text-[10px] text-[var(--text-faint)]">Req: {interactionRequestId}</p>
        ) : null}
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Projets du client</p>
          <Badge variant="neutral">{projectsLoading ? 'Chargement…' : `${projects.length} projet(s)`}</Badge>
        </div>
        {projectsError ? <p className="text-xs font-semibold text-rose-500">{projectsError}</p> : null}
        {projectsRequestId ? (
          <p className="text-[10px] text-[var(--text-faint)]">Req: {projectsRequestId}</p>
        ) : null}
        {projectsLoading ? (
          <p className="text-sm text-[var(--text-secondary)]">Chargement des projets…</p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Aucun projet lié pour le moment.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {projects.map((project) => (
              <Card key={project.id} className="space-y-1 border border-[var(--border)] bg-[var(--surface)]/70 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{project.name}</p>
                  <Badge variant="neutral">{project.status}</Badge>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Quote: {project.quoteStatus} · Dépôt: {project.depositStatus} · Progress: {project.progress}%
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/app/pro/${businessId}/projects/${project.id}`}>Ouvrir</Link>
                </Button>
              </Card>
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Finances du client</p>
          <Badge variant="neutral">{financeLoading ? 'Chargement…' : `${financeLines.length} ligne(s)`}</Badge>
        </div>
        {financeError ? <p className="text-xs font-semibold text-rose-500">{financeError}</p> : null}
        {financeRequestId ? (
          <p className="text-[10px] text-[var(--text-faint)]">Req: {financeRequestId}</p>
        ) : null}
        {financeLoading ? (
          <p className="text-sm text-[var(--text-secondary)]">Chargement des mouvements…</p>
        ) : financeLines.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">
            Aucun mouvement lié aux projets de ce client pour l’instant.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-3 text-sm text-[var(--text-secondary)]">
              <span>Total revenus: {formatCents(incomeTotalCents)}</span>
              <span>Total dépenses: {formatCents(expenseTotalCents)}</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-[var(--border)]">
              <table className="min-w-full divide-y divide-[var(--border)]">
                <thead className="bg-[var(--surface)]">
                  <tr className="text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                    <th className="px-4 py-3">Projet</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Montant</th>
                    <th className="px-4 py-3">Catégorie</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
                  {financeLines.slice(0, 10).map((line) => (
                    <tr key={line.id} className="text-sm text-[var(--text-primary)]">
                      <td className="px-4 py-3">{line.projectName ?? line.projectId ?? '—'}</td>
                      <td className="px-4 py-3">{line.type === 'INCOME' ? 'Revenu' : 'Dépense'}</td>
                      <td className="px-4 py-3">{formatCents(line.amountCents)}</td>
                      <td className="px-4 py-3">{line.category}</td>
                      <td className="px-4 py-3">{formatDate(line.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
