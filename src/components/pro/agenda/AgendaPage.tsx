"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { fetchJson } from '@/lib/apiClient';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { KpiCirclesBlock } from '@/components/pro/KpiCirclesBlock';
import { ContactCard } from '@/components/pro/crm/ContactCard';

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

const tabs = [
  { key: 'clients', label: 'Clients' },
  { key: 'prospects', label: 'Prospects' },
];

export default function AgendaPage({ businessId, view = 'agenda' }: Props) {
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

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-[var(--text-secondary)]">
            <Link href={`/app/pro/${businessId}`} className="hover:text-[var(--text-primary)]">
              ← Dashboard
            </Link>
          </p>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Agenda</h1>
          <p className="text-sm text-[var(--text-secondary)]">Clients et prospects de l’entreprise</p>
        </div>
        <Link
          href={`/app/pro/${businessId}/clients`}
          className="cursor-pointer rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
          onClick={(e) => {
            e.preventDefault();
            setCreateOpen(true);
          }}
        >
          Ajouter un contact
        </Link>
      </header>

      <KpiCirclesBlock items={kpis} />

      {view === 'agenda' ? (
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as 'clients' | 'prospects')}
              className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition ${
                activeTab === tab.key
                  ? 'border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
              }`}
              aria-pressed={activeTab === tab.key}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? (
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
            {activeTab === 'clients' ? 'Aucun client' : 'Aucun prospect'} pour l’instant.
          </p>
          <div className="flex gap-2">
            <Link
              href={`/app/pro/${businessId}/clients`}
              className="cursor-pointer rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            >
              {activeTab === 'clients' ? 'Ajouter un client' : 'Ajouter un prospect'}
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {currentList.map((contact) => {
            const cardProspect = view === 'prospects' || activeTab === 'prospects';
            const cardStats = statsByClient.get(contact.id);
            const status: 'active' | 'inactive' | 'neutral' = cardProspect
              ? 'neutral'
              : (cardStats?.active ?? 0) > 0
                ? 'active'
                : 'inactive';
            return (
              <ContactCard
                key={contact.id}
                href={`/app/pro/${businessId}/${cardProspect ? 'prospects' : 'clients'}/${contact.id}`}
                contact={contact}
                stats={
                  cardStats
                    ? { ...cardStats, lastInteraction: contact.lastContactAt ?? cardStats.lastInteraction }
                    : undefined
                }
                status={status}
              />
            );
          })}
        </div>
      )}

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
          />
          <Input
            label="Email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            type="email"
          />
          <Input
            label="Entreprise"
            value={form.company}
            onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))}
          />
          <Input
            label="Site web (logo)"
            value={form.websiteUrl}
            onChange={(e) => setForm((prev) => ({ ...prev, websiteUrl: e.target.value }))}
            placeholder="https://exemple.com"
          />
          <label className="space-y-1 text-sm text-[var(--text-primary)]">
            <span className="text-xs text-[var(--text-secondary)]">Type</span>
            <select
              className="w-full cursor-pointer rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              value={form.type}
              onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as 'client' | 'prospect' }))}
            >
              <option value="client">Client</option>
              <option value="prospect">Prospect</option>
            </select>
          </label>
          {createError ? <p className="text-xs text-rose-500">{createError}</p> : null}
          {createSuccess ? <p className="text-xs text-emerald-500">{createSuccess}</p> : null}
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
              disabled={creating}
            >
              {creating ? 'Ajout…' : 'Ajouter'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ContactRow / MetricsRows remplacés par ContactCard partagé pour alignement Studio
