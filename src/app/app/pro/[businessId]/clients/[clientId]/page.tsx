// Client detail page - premium, minimal CRM view
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { LogoAvatar } from '@/components/pro/LogoAvatar';
import { MoreVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { normalizeWebsiteUrl } from '@/lib/website';
import { KpiCirclesBlock } from '@/components/pro/KpiCirclesBlock';
import { formatCurrencyEUR } from '@/lib/formatCurrency';

type Client = {
  id: string;
  name: string;
  email: string | null;
  websiteUrl: string | null;
  notes: string | null;
  company?: string | null;
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

type Interaction = {
  id: string;
  type?: string | null;
  content?: string | null;
  happenedAt?: string | null;
};

type InteractionsResponse = { items?: Interaction[] };

const tabs = [
  { key: 'projects', label: 'Projets' },
  { key: 'documents', label: 'Documents' },
  { key: 'interactions', label: 'Interactions' },
  { key: 'infos', label: 'Infos' },
];

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const businessId = (params?.businessId ?? '') as string;
  const clientId = (params?.clientId ?? '') as string;

  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'projects' | 'documents' | 'interactions' | 'infos'>('projects');
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
        const [clientRes, projectsRes, interactionsRes] = await Promise.all([
          fetchJson<ClientResponse>(`/api/pro/businesses/${businessId}/clients/${clientId}`, {}, controller.signal),
          fetchJson<ProjectsResponse>(
            `/api/pro/businesses/${businessId}/projects?clientId=${clientId}&archived=false`,
            {},
            controller.signal,
          ),
          fetchJson<InteractionsResponse>(
            `/api/pro/businesses/${businessId}/interactions?clientId=${clientId}`,
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
        if (!interactionsRes.ok) setError((prev) => prev ?? interactionsRes.error ?? null);
        setClient(clientRes.data.item);
        setProjects(projectsRes.data?.items ?? []);
        setInteractions(interactionsRes.data?.items ?? []);
        setForm({
          name: clientRes.data.item.name ?? '',
          email: clientRes.data.item.email ?? '',
          company: clientRes.data.item.company ?? '',
          websiteUrl: clientRes.data.item.websiteUrl ?? '',
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

  const metrics = useMemo(() => {
    let total = 0;
    let active = 0;
    let valueCents = 0;
    for (const p of projects) {
      total += 1;
      if (p.status === 'IN_PROGRESS' || p.status === 'ACTIVE' || p.status === 'ONGOING') active += 1;
      const amount =
        typeof p.amountCents === 'string'
          ? Number(p.amountCents)
          : typeof p.amountCents === 'number'
            ? p.amountCents
            : 0;
      if (Number.isFinite(amount)) valueCents += amount;
    }
    const lastInteraction = interactions
      .map((i) => i.happenedAt)
      .filter(Boolean)
      .sort()
      .slice(-1)[0];
    return { total, active, valueCents, lastInteraction };
  }, [projects, interactions]);

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
          href={`/app/pro/${businessId}/agenda`}
          className="text-sm text-[var(--text-secondary)] underline-offset-4 hover:text-[var(--text-primary)]"
        >
          ← Retour à l’agenda
        </Link>
        <Card className="p-4 text-sm text-rose-500">{error ?? 'Client introuvable'}</Card>
      </div>
    );
  }

  const valueFormatted = formatCurrencyEUR(metrics.valueCents);

  const hasChanges = client
    ? form.name !== (client.name ?? '') ||
      form.email !== (client.email ?? '') ||
      form.company !== (client.company ?? '') ||
      form.websiteUrl !== (client.websiteUrl ?? '')
    : false;

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
      <Link
        href={`/app/pro/${businessId}/agenda`}
        className="text-sm text-[var(--text-secondary)] underline-offset-4 hover:text-[var(--text-primary)]"
      >
        ← Retour à l’agenda
      </Link>
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <LogoAvatar name={client.name} websiteUrl={client.websiteUrl ?? undefined} size={52} />
          <div className="space-y-1">
            <p className="text-lg font-semibold text-[var(--text-primary)]">{client.name}</p>
            {client.email ? <p className="text-sm text-[var(--text-secondary)]">{client.email}</p> : null}
            {client.websiteUrl ? (
              <p className="truncate text-sm text-[var(--text-secondary)]">{normalizeWebsiteUrl(client.websiteUrl).value}</p>
            ) : null}
            <StatusIndicator active={metrics.active > 0} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push(`/app/pro/${businessId}/projects?clientId=${clientId}`)}
            className="cursor-pointer rounded-md bg-neutral-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
          >
            Nouveau projet
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="cursor-pointer rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <MenuDots businessId={businessId} clientId={clientId} />
        </div>
      </header>

      <KpiCirclesBlock
        items={[
          { label: 'Projets', value: metrics.total },
          { label: 'En cours', value: metrics.active },
          { label: 'Valeur', value: valueFormatted },
          { label: 'Dernière', value: formatDate(metrics.lastInteraction) },
        ]}
      />

      <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Projets" value={metrics.total} />
          <Metric label="En cours" value={metrics.active} />
          <Metric label="Valeur" value={valueFormatted} />
          <Metric label="Dernière interaction" value={formatDate(metrics.lastInteraction)} />
        </div>
      </Card>

      {saveError ? <p className="text-sm text-rose-500">{saveError}</p> : null}
      {saveInfo ? <p className="text-sm text-emerald-500">{saveInfo}</p> : null}

      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
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
                  <span className="text-[11px] text-[var(--text-secondary)]">{p.status ?? 'INCONNU'}</span>
                </Link>
              ))
            )}
          </div>
        </Card>
      ) : null}

      {activeTab === 'documents' ? (
        <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <EmptyBlock message="Aucun document listé pour ce client." />
        </Card>
      ) : null}

      {activeTab === 'interactions' ? (
        <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          {interactions.length === 0 ? (
            <EmptyBlock message="Aucune interaction enregistrée." />
          ) : (
            <div className="grid gap-2">
              {interactions.map((i) => (
                <div
                  key={i.id}
                  className="rounded-xl border border-[var(--border)]/60 bg-[var(--surface-hover)] px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-[var(--text-primary)]">{i.type ?? 'Note'}</p>
                    <span className="text-xs text-[var(--text-secondary)]">{formatDate(i.happenedAt)}</span>
                  </div>
                  {i.content ? <p className="text-sm text-[var(--text-primary)]">{i.content}</p> : null}
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      {activeTab === 'infos' ? (
        <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="space-y-3 text-sm text-[var(--text-secondary)]">
            <Input
              label="Nom"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
            <Input
              label="Email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            />
            <Input
              label="Entreprise"
              value={form.company}
              onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))}
            />
            <Input
              label="Site web"
              value={form.websiteUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, websiteUrl: e.target.value }))}
              placeholder="https://exemple.com"
            />
            <InfoRow label="Notes" value={client.notes ?? '—'} />
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-[var(--surface-hover)]/60 px-3 py-3">
      <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">{label}</p>
      <p className="text-lg font-semibold text-[var(--text-primary)]">{value}</p>
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

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-[var(--surface-hover)]/60 px-3 py-2">
      <span>{label}</span>
      <span className="text-[var(--text-primary)] font-medium">{value}</span>
    </div>
  );
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
