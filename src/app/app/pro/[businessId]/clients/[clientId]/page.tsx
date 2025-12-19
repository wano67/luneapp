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

type Client = {
  id: string;
  businessId: string;
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

export default function ClientDetailPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const clientId = (params?.clientId ?? '') as string;
  const activeCtx = useActiveBusiness({ optional: true });
  const role = activeCtx?.activeBusiness?.role;
  const canEditInteractions = role === 'ADMIN' || role === 'OWNER';

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchController = useRef<AbortController | null>(null);
  const interactionsController = useRef<AbortController | null>(null);

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

        setClient(res.data.item);
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, clientId]);

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
            <p className="text-xs text-[var(--text-secondary)]">
              Cockpit client — données live, blocs finances/projets à venir.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">ID {client.id}</Badge>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Card className="space-y-1 border-dashed border-[var(--border)] bg-transparent p-3">
            <p className="text-xs font-semibold text-[var(--text-primary)]">LTV (stub)</p>
            <p className="text-sm text-[var(--text-secondary)]">
              TODO: connecter revenu cumulé quand l’API finances sera prête.
            </p>
          </Card>
          <Card className="space-y-1 border-dashed border-[var(--border)] bg-transparent p-3">
            <p className="text-xs font-semibold text-[var(--text-primary)]">Créé le</p>
            <p className="text-sm text-[var(--text-secondary)]">{formatDate(client.createdAt)}</p>
          </Card>
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
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Projets du client — stub</p>
          <Badge variant="neutral">À venir</Badge>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          TODO: GET /api/pro/businesses/{businessId}/clients/{clientId}/projects pour lier les projets.
        </p>
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Finances — stub</p>
          <Badge variant="neutral">À venir</Badge>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          TODO: endpoints finances (factures, paiements, dépenses) pour calculer LTV et santé client.
        </p>
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Notes & upsell — stub</p>
          <Badge variant="neutral">Bientôt</Badge>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          Prévoir un bloc notes interne et opportunités d’upsell.
        </p>
      </Card>
    </div>
  );
}
