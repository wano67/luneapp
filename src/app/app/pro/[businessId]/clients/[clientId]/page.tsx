// Client detail page - premium, minimal CRM view
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { LogoAvatar } from '@/components/pro/LogoAvatar';
import { MoreVertical } from 'lucide-react';
import { normalizeWebsiteUrl } from '@/lib/website';
import { KpiCirclesBlock } from '@/components/pro/KpiCirclesBlock';
import { formatCurrencyEUR } from '@/lib/formatCurrency';
import { ClientAccountingTab } from '@/components/pro/clients/ClientAccountingTab';
import { PageHeaderPro } from '@/components/pro/PageHeaderPro';
import { TabsPills } from '@/components/pro/TabsPills';
import { ClientInteractionsTab } from '@/components/pro/clients/ClientInteractionsTab';
import { ClientDocumentsTab } from '@/components/pro/clients/ClientDocumentsTab';
import { ClientInfoTab } from '@/components/pro/clients/ClientInfoTab';

type Client = {
  id: string;
  name: string;
  email: string | null;
  websiteUrl: string | null;
  notes: string | null;
  phone?: string | null;
  sector?: string | null;
  status?: string | null;
  leadSource?: string | null;
  company?: string | null;
  categoryReferenceId?: string | null;
  categoryReferenceName?: string | null;
  tagReferences?: Array<{ id: string; name: string }>;
};

type ClientResponse = { item: Client };

type Project = {
  id: string;
  name: string;
  status?: string | null;
  amountCents?: string | number | null;
  startDate?: string | null;
  archivedAt?: string | null;
};

type ProjectsResponse = { items?: Project[] };
type SummaryResponse = {
  totals: { invoicedCents: number; paidCents: number; outstandingCents: number };
  invoices: Array<{
    id: string;
    number: string | null;
    status: string;
    totalCents: number;
    currency: string;
    issuedAt: string | null;
    dueAt: string | null;
    projectName: string | null;
  }>;
  payments: Array<{
    id: string;
    amountCents: number;
    currency: string;
    paidAt: string;
    reference: string | null;
  }>;
};
type Interaction = {
  id: string;
  type: string;
  content: string | null;
  happenedAt: string;
  createdByUserId: string | null;
};

type TabKey = 'projects' | 'accounting' | 'interactions' | 'subscriptions' | 'documents' | 'infos';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'projects', label: 'Projets' },
  { key: 'accounting', label: 'Comptabilité' },
  { key: 'interactions', label: 'Interactions' },
  { key: 'subscriptions', label: 'Abonnements' },
  { key: 'documents', label: 'Documents' },
  { key: 'infos', label: 'Infos' },
];

function isActiveProjectStatus(status?: string | null) {
  return status === 'IN_PROGRESS' || status === 'ACTIVE' || status === 'ONGOING';
}

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const businessId = (params?.businessId ?? '') as string;
  const clientId = (params?.clientId ?? '') as string;

  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountingData, setAccountingData] = useState<SummaryResponse | null>(null);
  const [accountingLoaded, setAccountingLoaded] = useState(false);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [interactionsLoaded, setInteractionsLoaded] = useState(false);
  const [kpis, setKpis] = useState<Array<{ label: string; value: string | number }>>([
    { label: 'Projets', value: '—' },
    { label: 'En cours', value: '—' },
    { label: 'Valeur', value: '—' },
  ]);
  const [activeTab, setActiveTab] = useState<TabKey>('projects');
  const [form, setForm] = useState<{ name: string; email: string; company: string; websiteUrl: string }>({
    name: '',
    email: '',
    company: '',
    websiteUrl: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveInfo, setSaveInfo] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [clientRes, projectsRes] = await Promise.all([
          fetchJson<ClientResponse>(`/api/pro/businesses/${businessId}/clients/${clientId}`, {}, controller.signal),
          fetchJson<ProjectsResponse>(
            `/api/pro/businesses/${businessId}/projects?clientId=${clientId}&archived=false`,
            {},
            controller.signal,
          ),
        ]);
        if (controller.signal.aborted) return;
        if (!clientRes.ok || !clientRes.data) {
          setError(clientRes.error ?? 'Client introuvable');
          return;
        }
        if (!projectsRes.ok) setError((prev) => prev ?? projectsRes.error ?? null);
        const rawClient = clientRes.data as ClientResponse | Client;
        const clientData: Client = (rawClient as ClientResponse).item ?? (rawClient as Client);
        setClient(clientData);
        setProjects(projectsRes.data?.items ?? []);
        setForm({
          name: clientData.name ?? '',
          email: clientData.email ?? '',
          company: clientData.company ?? '',
          websiteUrl: clientData.websiteUrl ?? '',
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(getErrorMessage(err));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [businessId, clientId]);

  const buildProjectKpis = useCallback(() => {
    let total = 0;
    let active = 0;
    let valueCents = 0;
    for (const p of projects) {
      total += 1;
      if (isActiveProjectStatus(p.status)) active += 1;
      const amount =
        typeof p.amountCents === 'string'
          ? Number(p.amountCents)
          : typeof p.amountCents === 'number'
            ? p.amountCents
            : 0;
      if (Number.isFinite(amount)) valueCents += amount;
    }
    return [
      { label: 'Projets', value: total },
      { label: 'En cours', value: active },
      { label: 'Valeur', value: formatCurrencyEUR(valueCents) },
    ];
  }, [projects]);

  const buildAccountingKpis = useCallback(
    (data?: SummaryResponse | null) => {
      const totals = data?.totals ?? accountingData?.totals;
      if (!totals) {
        return [
          { label: 'Facturé', value: '—' },
          { label: 'Encaissé', value: '—' },
          { label: 'En attente', value: '—' },
        ];
      }
      return [
        { label: 'Facturé', value: formatCurrencyEUR(totals.invoicedCents) },
        { label: 'Encaissé', value: formatCurrencyEUR(totals.paidCents) },
        { label: 'En attente', value: formatCurrencyEUR(totals.outstandingCents) },
      ];
    },
    [accountingData],
  );

  function computeResponseDelay(items: Interaction[]) {
    if (!items.length) return null;
    const toTime = (value?: string | null) => {
      if (!value) return Number.NaN;
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? Number.NaN : d.getTime();
    };
    const sorted = [...items].sort((a, b) => {
      const aDate = toTime(a.happenedAt);
      const bDate = toTime(b.happenedAt);
      return aDate - bDate;
    });
    const deltas: number[] = [];
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = toTime(sorted[i - 1].happenedAt);
      const curr = toTime(sorted[i].happenedAt);
      if (Number.isFinite(prev) && Number.isFinite(curr) && curr > prev) deltas.push(curr - prev);
    }
    if (!deltas.length) return null;
    const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    return avg;
  }

  function formatResponseDelay(ms: number | null) {
    if (ms == null || !Number.isFinite(ms)) return '—';
    const hours = ms / (1000 * 60 * 60);
    if (hours < 24) return `${Math.round(hours)}h`;
    const days = hours / 24;
    return `${Math.round(days)}j`;
  }

  const buildInteractionKpis = useCallback(
    (list?: Interaction[]) => {
      const source = list ?? interactions;
      const sent = source.length;
      const received = 0;
      const delayMs = computeResponseDelay(source);
      return [
        { label: 'Envoyés', value: sent },
        { label: 'Reçus', value: received },
        { label: 'Délai', value: formatResponseDelay(delayMs) },
      ];
    },
    [interactions],
  );

  useEffect(() => {
    if (activeTab === 'accounting') {
      setKpis(buildAccountingKpis());
    } else if (activeTab === 'interactions') {
      setKpis(buildInteractionKpis());
    } else {
      setKpis(buildProjectKpis());
    }
  }, [activeTab, buildAccountingKpis, buildInteractionKpis, buildProjectKpis]);

  const projectMetrics = useMemo(() => {
    let total = 0;
    let active = 0;
    for (const p of projects) {
      total += 1;
      if (isActiveProjectStatus(p.status)) active += 1;
    }
    return { total, active };
  }, [projects]);

  const hasChanges = client
    ? form.name !== (client.name ?? '') ||
      form.email !== (client.email ?? '') ||
      form.company !== (client.company ?? '') ||
      form.websiteUrl !== (client.websiteUrl ?? '')
    : false;

  const handleClientUpdated = useCallback(
    (updated: Client) => {
      setClient(updated);
      setForm({
        name: updated.name ?? '',
        email: updated.email ?? '',
        company: updated.company ?? '',
        websiteUrl: updated.websiteUrl ?? '',
      });
    },
    [],
  );

  const handleSummaryChange = useCallback(
    (data: SummaryResponse | null) => {
      setAccountingData(data);
      setAccountingLoaded(true);
      if (activeTab === 'accounting') {
        setKpis(buildAccountingKpis(data));
      }
    },
    [activeTab, buildAccountingKpis],
  );

  const handleInteractionsChange = useCallback(
    (items: Interaction[]) => {
      setInteractions(items);
      setInteractionsLoaded(true);
      if (activeTab === 'interactions') {
        setKpis(buildInteractionKpis(items));
      }
    },
    [activeTab, buildInteractionKpis],
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <Card className="h-32 animate-pulse rounded-2xl bg-[var(--surface)]">
          <div className="h-full w-full rounded-xl bg-[var(--surface-hover)]" />
        </Card>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((k) => (
            <Card key={k} className="h-20 animate-pulse rounded-xl bg-[var(--surface)]">
              <div className="h-full w-full rounded-lg bg-[var(--surface-hover)]" />
            </Card>
          ))}
        </div>
        <Card className="h-64 animate-pulse rounded-2xl bg-[var(--surface)]">
          <div className="h-full w-full rounded-xl bg-[var(--surface-hover)]" />
        </Card>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="mx-auto max-w-5xl space-y-3 px-4 py-6">
        <Link
          href={`/app/pro/${businessId}/clients`}
          className="text-sm text-[var(--text-secondary)] underline-offset-4 hover:text-[var(--text-primary)]"
        >
          ← Retour aux clients
        </Link>
        <Card className="p-4 text-sm text-rose-500">{error ?? 'Client introuvable'}</Card>
      </div>
    );
  }

  async function handleSave() {
    setSaveInfo(null);
    setSaveError(null);
    if (!client) {
      setSaveError('Client introuvable');
      return;
    }
    try {
      setSaving(true);
      const body = {
        name: form.name.trim() || client.name,
        email: form.email.trim() || null,
        company: form.company.trim() || null,
        websiteUrl: form.websiteUrl.trim() || null,
      };
      const res = await fetchJson<ClientResponse>(
        `/api/pro/businesses/${businessId}/clients/${clientId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok || !res.data) {
        setSaveError(res.error ?? 'Enregistrement impossible');
        return;
      }
      setClient(res.data.item);
      setSaveInfo('Enregistré');
      setForm({
        name: res.data.item.name ?? '',
        email: res.data.item.email ?? '',
        company: res.data.item.company ?? '',
        websiteUrl: res.data.item.websiteUrl ?? '',
      });
    } catch (err) {
      setSaveError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <div className="flex justify-end">
        <Link
          href={`/app/pro/${businessId}/agenda?clientId=${clientId}`}
          className="text-xs font-semibold text-[var(--text-secondary)] underline underline-offset-4 transition hover:text-[var(--text-primary)]"
        >
          Ouvrir dans le CRM
        </Link>
      </div>
      <PageHeaderPro
        backHref={`/app/pro/${businessId}/clients`}
        backLabel="Clients"
        title={client.name}
        subtitle={
          <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
            {client.email ? <span className="truncate">{client.email}</span> : null}
            {client.websiteUrl ? (
              <span className="truncate text-[var(--text-secondary)]">
                {normalizeWebsiteUrl(client.websiteUrl).value}
              </span>
            ) : null}
            <StatusIndicator active={projectMetrics.active > 0} />
          </div>
        }
        leading={<LogoAvatar name={client.name} websiteUrl={client.websiteUrl ?? undefined} size={52} />}
        actions={
          <>
            <button
              type="button"
              onClick={() => router.push(`/app/pro/${businessId}/projects?clientId=${clientId}`)}
              className="w-full cursor-pointer rounded-md bg-neutral-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] sm:w-auto"
            >
              Nouveau projet
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="w-full cursor-pointer rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <MenuDots businessId={businessId} clientId={clientId} />
          </>
        }
      />

      <KpiCirclesBlock items={kpis} />

      {saveError ? <p className="text-sm text-rose-500">{saveError}</p> : null}
      {saveInfo ? <p className="text-sm text-emerald-500">{saveInfo}</p> : null}

      <TabsPills
        items={tabs}
        value={activeTab}
        onChange={(key) => setActiveTab(key as typeof activeTab)}
        ariaLabel="Sections client"
        className="-mx-1 px-1"
      />

      {activeTab === 'projects' ? (
        <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="grid gap-2">
            {projects.length === 0 ? (
              <EmptyBlock message="Aucun projet" />
            ) : (
              projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/app/pro/${businessId}/projects/${p.id}`}
                  className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm transition hover:bg-[var(--surface-hover)]"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-semibold text-[var(--text-primary)]">{p.name}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{formatDate(p.startDate)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-right">
                    <span className="text-[11px] text-[var(--text-secondary)]">{p.status ?? 'INCONNU'}</span>
                    {p.amountCents != null ? (
                      <span className="text-[var(--text-primary)] text-xs font-semibold">
                        {formatCurrencyEUR(
                          typeof p.amountCents === 'string' ? Number(p.amountCents) : (p.amountCents ?? 0),
                        )}
                      </span>
                    ) : null}
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>
      ) : null}

      {activeTab === 'accounting' ? (
        <ClientAccountingTab
          businessId={businessId}
          clientId={clientId}
          initialData={accountingData}
          alreadyLoaded={accountingLoaded}
          onSummaryChange={handleSummaryChange}
        />
      ) : null}

      {activeTab === 'subscriptions' ? (
        <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <EmptyBlock message="Abonnements / récurrences bientôt disponibles." />
        </Card>
      ) : null}

      {activeTab === 'documents' ? (
        <ClientDocumentsTab businessId={businessId} clientId={clientId} />
      ) : null}

      {activeTab === 'interactions' ? (
        <ClientInteractionsTab
          businessId={businessId}
          clientId={clientId}
          initialItems={interactions}
          alreadyLoaded={interactionsLoaded}
          onChange={handleInteractionsChange}
        />
      ) : null}

      {activeTab === 'infos' ? (
        <ClientInfoTab
          businessId={businessId}
          clientId={clientId}
          client={client}
          onUpdated={handleClientUpdated}
        />
      ) : null}
    </div>
  );
}

function EmptyBlock({ message }: { message: string }) {
  return <p className="text-sm text-[var(--text-secondary)]">{message}</p>;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return '—';
  }
}

function StatusIndicator({ active }: { active: boolean }) {
  const indicator = active
    ? { icon: '●', label: 'Actif', className: 'text-emerald-500' }
    : { icon: '✕', label: 'Inactif', className: 'text-[var(--text-secondary)]' };
  return (
    <span className={`flex items-center gap-1 text-[12px] font-medium ${indicator.className}`}>
      <span aria-hidden>{indicator.icon}</span>
      <span>{indicator.label}</span>
    </span>
  );
}

function MenuDots({ businessId, clientId }: { businessId: string; clientId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Actions"
        className="cursor-pointer rounded-md p-2 text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical size={18} />
      </button>
      {open ? (
        <div className="absolute right-0 z-10 mt-2 w-40 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 shadow-lg">
          {[
            { label: 'Projets', href: `/app/pro/${businessId}/projects?clientId=${clientId}` },
            { label: 'Documents', href: `/app/pro/${businessId}/clients/${clientId}#documents` },
            { label: 'Interactions', href: `/app/pro/${businessId}/clients/${clientId}#interactions` },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
