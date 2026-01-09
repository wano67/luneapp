"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { fetchJson } from '@/lib/apiClient';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { KpiCirclesBlock } from '@/components/pro/KpiCirclesBlock';
import { ContactCard } from '@/components/pro/crm/ContactCard';
import { PageHeaderPro } from '@/components/pro/PageHeaderPro';
import { TabsPills } from '@/components/pro/TabsPills';
import { useActiveBusiness } from '@/app/app/pro/ActiveBusinessProvider';

type ViewMode = 'agenda' | 'clients' | 'prospects';
type Props = { businessId: string; view?: ViewMode };

type Contact = {
  id: string;
  name: string;
  email?: string | null;
  company?: string | null;
  websiteUrl?: string | null;
  status?: string | null;
  lastContactAt?: string | null;
  createdAt?: string | null;
};

type ListResponse = { items?: Contact[] };
type ProjectRow = { id: string; clientId: string | null; status?: string | null; amountCents?: number | string | null };
type ProjectsResponse = { items?: ProjectRow[] };
type ProjectCreateResponse = { id: string };
type ConvertResponse = { clientId: string; projectId: string };
type ActionResult = { projectId: string; clientId?: string };

const tabs = [
  { key: 'clients', label: 'Clients' },
  { key: 'prospects', label: 'Prospects' },
];

export default function AgendaPage({ businessId, view = 'agenda' }: Props) {
  const activeCtx = useActiveBusiness({ optional: true });
  const isAdmin = activeCtx?.isAdmin ?? false;
  const readOnlyMessage = 'Réservé aux admins/owners.';
  const canWrite = isAdmin;
  const isAgendaView = view === 'agenda';
  const [activeTab, setActiveTab] = useState<'clients' | 'prospects'>(view === 'prospects' ? 'prospects' : 'clients');
  const [clients, setClients] = useState<Contact[]>([]);
  const [prospects, setProspects] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState({
    name: '',
    email: '',
    company: '',
    type: 'client' as 'client' | 'prospect',
    websiteUrl: '',
  });
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [actionOpen, setActionOpen] = useState(false);
  const [actionTarget, setActionTarget] = useState<{
    type: 'client' | 'prospect';
    id: string;
    name: string;
  } | null>(null);
  const [actionName, setActionName] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);

  const openCreate = useCallback(
    (type?: 'client' | 'prospect') => {
      if (!canWrite) return;
      if (type) {
        setForm((prev) => ({ ...prev, type }));
      }
      setCreateError(null);
      setCreateSuccess(null);
      setCreateOpen(true);
    },
    [canWrite]
  );

  const openAction = useCallback((type: 'client' | 'prospect', id: string, name?: string | null) => {
    const label = name?.trim() || (type === 'client' ? 'Client' : 'Prospect');
    setActionTarget({ type, id, name: label });
    setActionName(`Projet - ${label}`);
    setActionError(null);
    setActionResult(null);
    setActionOpen(true);
  }, []);

  const closeAction = useCallback(() => {
    if (actionLoading) return;
    setActionOpen(false);
    setActionTarget(null);
    setActionName('');
    setActionError(null);
    setActionResult(null);
  }, [actionLoading]);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [clientsRes, prospectsRes, projectsRes] = await Promise.all([
          fetchJson<ListResponse>(`/api/pro/businesses/${businessId}/clients`, {}, controller.signal),
          fetchJson<ListResponse>(`/api/pro/businesses/${businessId}/prospects`, {}, controller.signal),
          fetchJson<ProjectsResponse>(`/api/pro/businesses/${businessId}/projects?archived=false`, {}, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        if (!clientsRes.ok || !prospectsRes.ok || !projectsRes.ok) {
          setError(clientsRes.error || prospectsRes.error || projectsRes.error || 'Agenda indisponible');
          return;
        }
        setClients(clientsRes.data?.items ?? []);
        setProspects(prospectsRes.data?.items ?? []);
        setProjects(projectsRes.data?.items ?? []);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError((err as Error)?.message ?? 'Agenda indisponible');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [businessId, refreshKey]);

  const currentList = useMemo(() => {
    if (view === 'clients') return clients;
    if (view === 'prospects') return prospects;
    return activeTab === 'clients' ? clients : prospects;
  }, [activeTab, clients, prospects, view]);

  const statsByClient = useMemo(() => {
    const map = new Map<
      string,
      { projects: number; active: number; valueCents: number; lastInteraction?: string | null }
    >();
    for (const p of projects) {
      if (!p.clientId) continue;
      const entry = map.get(p.clientId) ?? { projects: 0, active: 0, valueCents: 0, lastInteraction: null };
      entry.projects += 1;
      if (p.status === 'IN_PROGRESS' || p.status === 'ACTIVE' || p.status === 'ONGOING') {
        entry.active += 1;
      }
      if (p.amountCents) {
        const amount =
          typeof p.amountCents === 'string'
            ? Number(p.amountCents)
            : typeof p.amountCents === 'number'
              ? p.amountCents
              : 0;
        entry.valueCents += Number.isFinite(amount) ? amount : 0;
      }
      map.set(p.clientId, entry);
    }
    return map;
  }, [projects]);

  const kpis = useMemo(() => {
    if (view === 'prospects' || activeTab === 'prospects') {
      const total = prospects.length;
      const enCours = prospects.filter((p) => (p.status ? p.status !== 'LOST' : true)).length;
      const won = prospects.filter((p) => p.status === 'WON').length;
      const conversion = total > 0 ? Math.round((won / total) * 100) : 0;
      return [
        { label: 'Prospects', value: total },
        { label: 'En cours', value: enCours },
        { label: 'Conversion', value: `${conversion}%` },
      ];
    }
    const total = clients.length;
    let actifs = 0;
    let valueCents = 0;
    statsByClient.forEach((v) => {
      if (v.active > 0) actifs += 1;
      valueCents += v.valueCents || 0;
    });
    return [
      { label: 'Clients', value: total },
      { label: 'Actifs', value: actifs },
      {
        label: 'Valeur',
        value: new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(
          (valueCents || 0) / 100,
        ),
      },
    ];
  }, [activeTab, clients, prospects, statsByClient, view]);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);
    if (!canWrite) {
      setCreateError(readOnlyMessage);
      return;
    }
    if (!form.name.trim()) {
      setCreateError('Le nom est requis');
      return;
    }
    const endpoint =
      form.type === 'client'
        ? `/api/pro/businesses/${businessId}/clients`
        : `/api/pro/businesses/${businessId}/prospects`;
    try {
      setCreating(true);
      const res = await fetchJson(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          company: form.company.trim() || undefined,
          websiteUrl: form.websiteUrl.trim() || undefined,
        }),
      });
      if (!res.ok) {
        setCreateError(res.error ?? 'Création impossible');
        return;
      }
      setCreateSuccess('Contact créé');
      setForm({ name: '', email: '', company: '', type: form.type, websiteUrl: '' });
      setCreateOpen(false);
      setRefreshKey((v) => v + 1);
    } catch (err) {
      setCreateError((err as Error)?.message ?? 'Création impossible');
    } finally {
      setCreating(false);
    }
  }

  async function handleAction() {
    if (!actionTarget) return;
    setActionError(null);
    setActionResult(null);
    if (!canWrite) {
      setActionError(readOnlyMessage);
      return;
    }
    const name = actionName.trim() || `Projet - ${actionTarget.name || 'Contact'}`;
    try {
      setActionLoading(true);
      if (actionTarget.type === 'client') {
        const res = await fetchJson<ProjectCreateResponse>(`/api/pro/businesses/${businessId}/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, clientId: actionTarget.id }),
        });
        if (!res.ok || !res.data) {
          const msg = res.error ?? 'Création impossible';
          setActionError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
          return;
        }
        setActionResult({ projectId: res.data.id });
      } else {
        const payload = actionName.trim() ? { projectName: actionName.trim() } : {};
        const res = await fetchJson<ConvertResponse>(
          `/api/pro/businesses/${businessId}/prospects/${actionTarget.id}/convert`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );
        if (!res.ok || !res.data) {
          const msg = res.error ?? 'Conversion impossible';
          setActionError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
          return;
        }
        setActionResult({ projectId: res.data.projectId, clientId: res.data.clientId });
      }
      setRefreshKey((v) => v + 1);
    } catch (err) {
      setActionError((err as Error)?.message ?? 'Action impossible');
    } finally {
      setActionLoading(false);
    }
  }

  const isProspectView = view === 'prospects' || activeTab === 'prospects';
  const pageTitle = view === 'clients' ? 'Clients' : view === 'prospects' ? 'Prospects' : 'Agenda';
  const pageSubtitle =
    view === 'clients'
      ? 'Liste des clients de l’entreprise'
      : view === 'prospects'
        ? 'Suivi des prospects de l’entreprise'
        : 'Clients et prospects de l’entreprise';
  const actionTitle =
    actionTarget?.type === 'client' ? 'Créer un projet' : actionTarget?.type === 'prospect' ? 'Convertir' : 'Action';
  const actionDescription =
    actionTarget?.type === 'client'
      ? 'Créer un projet lié à ce client.'
      : actionTarget?.type === 'prospect'
        ? 'Convertir ce prospect en client et générer un projet.'
        : 'Action rapide';
  const actionPrimaryLabel = actionTarget?.type === 'client' ? 'Créer le projet' : 'Convertir';

  const listContent = loading ? (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((key) => (
        <Card key={key} className="min-h-[240px] animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="h-full w-full rounded-2xl bg-[var(--surface-hover)]" />
        </Card>
      ))}
    </div>
  ) : error ? (
    <Card className="p-4 text-sm text-rose-500">{error}</Card>
  ) : currentList.length === 0 ? (
    <Card className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="text-sm font-semibold text-[var(--text-primary)]">
        {isProspectView ? 'Aucun prospect' : 'Aucun client'} pour l’instant.
      </p>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => openCreate(isProspectView ? 'prospect' : 'client')}
          className="cursor-pointer rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canWrite}
        >
          {isProspectView ? 'Ajouter un prospect' : 'Ajouter un client'}
        </button>
        {!canWrite ? <span className="text-xs text-[var(--text-secondary)]">{readOnlyMessage}</span> : null}
      </div>
    </Card>
  ) : (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {currentList.map((contact) => {
        const cardProspect = isProspectView;
        const cardStats = statsByClient.get(contact.id);
        const status: 'active' | 'inactive' | 'neutral' = cardProspect
          ? 'neutral'
          : (cardStats?.active ?? 0) > 0
            ? 'active'
            : 'inactive';
        const cardType = cardProspect ? 'prospect' : 'client';
        const cardHref = `/app/pro/${businessId}/${cardProspect ? 'prospects' : 'clients'}/${contact.id}`;
        return (
          <ContactCard
            key={contact.id}
            href={cardHref}
            contact={contact}
            stats={
              cardStats
                ? { ...cardStats, lastInteraction: contact.lastContactAt ?? cardStats.lastInteraction }
                : undefined
            }
            status={status}
            actions={
              isAgendaView ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => openAction(cardType, contact.id, contact.name)}
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!canWrite}
                  >
                    {cardType === 'client' ? 'Créer un projet' : 'Convertir'}
                  </button>
                  {!canWrite ? (
                    <span className="text-[10px] text-[var(--text-secondary)]">{readOnlyMessage}</span>
                  ) : null}
                </div>
              ) : null
            }
          />
        );
      })}
    </div>
  );

  return (
    <div className="w-full space-y-6 px-5 py-6 md:px-8 xl:px-10">
      <PageHeaderPro
        backHref={`/app/pro/${businessId}`}
        backLabel="Dashboard"
        title={pageTitle}
        subtitle={pageSubtitle}
        actions={
          <div className="flex flex-col gap-1 sm:items-end">
            <button
              type="button"
              onClick={() => openCreate(isProspectView ? 'prospect' : 'client')}
              className="w-full cursor-pointer rounded-md bg-neutral-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              disabled={!canWrite}
            >
              Ajouter un contact
            </button>
            {!canWrite ? <span className="text-xs text-[var(--text-secondary)]">{readOnlyMessage}</span> : null}
          </div>
        }
      />

      <KpiCirclesBlock items={kpis} />

      {isAgendaView ? (
        <TabsPills
          items={tabs}
          value={activeTab}
          onChange={(key) => setActiveTab(key as 'clients' | 'prospects')}
          ariaLabel="Agenda onglets"
          className="-mx-1 px-1"
        />
      ) : null}

      <div className="space-y-4">{listContent}</div>

      <Modal
        open={createOpen}
        onCloseAction={() => (!creating ? setCreateOpen(false) : null)}
        title="Ajouter un contact"
        description="Clients et prospects dans l’agenda."
      >
        <form className="space-y-4" onSubmit={handleCreate}>
          <Input
            label="Nom *"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            required
            disabled={!canWrite}
          />
          <Input
            label="Email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            type="email"
            disabled={!canWrite}
          />
          <Input
            label="Entreprise"
            value={form.company}
            onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))}
            disabled={!canWrite}
          />
          <Input
            label="Site web (logo)"
            value={form.websiteUrl}
            onChange={(e) => setForm((prev) => ({ ...prev, websiteUrl: e.target.value }))}
            placeholder="https://exemple.com"
            disabled={!canWrite}
          />
          <label className="space-y-1 text-sm text-[var(--text-primary)]">
            <span className="text-xs text-[var(--text-secondary)]">Type</span>
            <select
              className="w-full cursor-pointer rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              value={form.type}
              onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as 'client' | 'prospect' }))}
              disabled={!canWrite}
            >
              <option value="client">Client</option>
              <option value="prospect">Prospect</option>
            </select>
          </label>
          {createError ? <p className="text-xs text-rose-500">{createError}</p> : null}
          {createSuccess ? <p className="text-xs text-emerald-500">{createSuccess}</p> : null}
          {!canWrite ? <p className="text-xs text-[var(--text-secondary)]">{readOnlyMessage}</p> : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="cursor-pointer rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              disabled={creating}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="cursor-pointer rounded-md bg-neutral-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              disabled={creating || !canWrite}
            >
              {creating ? 'Ajout…' : 'Ajouter'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={actionOpen}
        onCloseAction={() => (!actionLoading ? closeAction() : null)}
        title={actionTitle}
        description={actionDescription}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleAction();
          }}
        >
          <Input
            label="Nom du projet"
            value={actionName}
            onChange={(event) => setActionName(event.target.value)}
            disabled={!actionTarget || !canWrite || actionLoading}
          />
          {actionError ? <p className="text-xs text-rose-500">{actionError}</p> : null}
          {actionResult ? (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-700">
              {actionTarget?.type === 'client' ? 'Projet créé.' : 'Conversion réussie.'}
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  href={`/app/pro/${businessId}/projects/${actionResult.projectId}`}
                  className="text-xs font-semibold underline underline-offset-4"
                >
                  Ouvrir le projet
                </Link>
                {actionResult.clientId ? (
                  <Link
                    href={`/app/pro/${businessId}/clients/${actionResult.clientId}`}
                    className="text-xs font-semibold underline underline-offset-4"
                  >
                    Ouvrir le client
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
          {!canWrite ? <p className="text-xs text-[var(--text-secondary)]">{readOnlyMessage}</p> : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeAction}
              className="cursor-pointer rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              disabled={actionLoading}
            >
              Fermer
            </button>
            <button
              type="submit"
              className="cursor-pointer rounded-md bg-neutral-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canWrite || actionLoading || !actionTarget || !!actionResult}
            >
              {actionLoading ? 'Traitement…' : actionPrimaryLabel}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
