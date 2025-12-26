// Prospect detail page - premium, minimal
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { LogoAvatar } from '@/components/pro/LogoAvatar';
import { MoreVertical } from 'lucide-react';

type Prospect = {
  id: string;
  name: string;
  contactName?: string | null;
  contactEmail?: string | null;
  websiteUrl?: string | null;
  pipelineStatus?: string | null;
  probability?: number | null;
  nextActionDate?: string | null;
  notes?: string | null;
};

type ProspectResponse = Prospect;

type Interaction = { id: string; content?: string | null; happenedAt?: string | null; type?: string | null };
type InteractionsResponse = { items?: Interaction[] };

const tabs = [
  { key: 'infos', label: 'Infos' },
  { key: 'interactions', label: 'Interactions' },
  { key: 'offers', label: 'Offres / Devis' },
];

export default function ProspectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const businessId = (params?.businessId ?? '') as string;
  const prospectId = (params?.prospectId ?? '') as string;

  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'infos' | 'interactions' | 'offers'>('infos');

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [prospectRes, interactionsRes] = await Promise.all([
          fetchJson<ProspectResponse>(
            `/api/pro/businesses/${businessId}/prospects/${prospectId}`,
            {},
            controller.signal,
          ),
          fetchJson<InteractionsResponse>(
            `/api/pro/businesses/${businessId}/interactions?prospectId=${prospectId}`,
            {},
            controller.signal,
          ),
        ]);
        if (controller.signal.aborted) return;
        if (!prospectRes.ok || !prospectRes.data) {
          setError(prospectRes.error ?? 'Prospect introuvable');
          return;
        }
        if (!interactionsRes.ok) setError((prev) => prev ?? interactionsRes.error ?? null);
        setProspect(prospectRes.data);
        setInteractions(interactionsRes.data?.items ?? []);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(getErrorMessage(err));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [businessId, prospectId]);

  const lastInteraction = useMemo(() => {
    return (
      interactions
        .map((i) => i.happenedAt)
        .filter(Boolean)
        .sort()
        .slice(-1)[0] ?? null
    );
  }, [interactions]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <Card className="h-32 animate-pulse rounded-2xl bg-[var(--surface)]">
          <div className="h-full w-full rounded-xl bg-[var(--surface-hover)]" />
        </Card>
        <Card className="h-24 animate-pulse rounded-2xl bg-[var(--surface)]">
          <div className="h-full w-full rounded-xl bg-[var(--surface-hover)]" />
        </Card>
      </div>
    );
  }

  if (error || !prospect) {
    return (
      <div className="mx-auto max-w-5xl space-y-3 px-4 py-6">
        <Link
          href={`/app/pro/${businessId}/agenda`}
          className="text-sm text-[var(--text-secondary)] underline-offset-4 hover:text-[var(--text-primary)]"
        >
          ← Retour à l’agenda
        </Link>
        <Card className="p-4 text-sm text-rose-500">{error ?? 'Prospect introuvable'}</Card>
      </div>
    );
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
          <LogoAvatar name={prospect.name || 'Prospect'} websiteUrl={prospect.websiteUrl ?? undefined} size={48} />
          <div className="space-y-1">
            <p className="text-lg font-semibold text-[var(--text-primary)]">{prospect.name}</p>
            {prospect.contactEmail ? (
              <p className="text-sm text-[var(--text-secondary)]">{prospect.contactEmail}</p>
            ) : null}
            <StatusIndicatorProspect />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push(`/app/pro/${businessId}/clients?from=prospect&prospectId=${prospectId}`)}
            className="cursor-pointer rounded-md bg-neutral-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
          >
            Convertir en client
          </button>
          <MenuDots businessId={businessId} prospectId={prospectId} />
        </div>
      </header>

      <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Statut pipeline" value={prospect.pipelineStatus ?? 'Non défini'} />
          <Metric label="Probabilité" value={prospect.probability ? `${prospect.probability}%` : '0%'} />
          <Metric label="Prochaine action" value={formatDate(prospect.nextActionDate)} />
          <Metric label="Dernière interaction" value={formatDate(lastInteraction)} />
        </div>
      </Card>

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

      {activeTab === 'infos' ? (
        <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="space-y-2 text-sm text-[var(--text-secondary)]">
            <InfoRow label="Contact" value={prospect.contactName ?? 'Non renseigné'} />
            <InfoRow label="Email" value={prospect.contactEmail ?? 'Non renseigné'} />
            <InfoRow label="Site" value={prospect.websiteUrl ?? 'Non renseigné'} />
            <InfoRow label="Notes" value={prospect.notes ?? '—'} />
          </div>
        </Card>
      ) : null}

      {activeTab === 'interactions' ? (
        <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          {interactions.length === 0 ? (
            <EmptyBlock message="Aucune interaction." />
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

      {activeTab === 'offers' ? (
        <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <EmptyBlock message="Aucune offre / devis pour l’instant." />
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

function StatusIndicatorProspect() {
  return (
    <span className="flex items-center gap-1 text-[12px] font-medium text-[var(--text-secondary)]">
      <span aria-hidden>○</span>
      <span>Prospect</span>
    </span>
  );
}

function MenuDots({ businessId, prospectId }: { businessId: string; prospectId: string }) {
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
            { label: 'Interactions', href: `/app/pro/${businessId}/prospects/${prospectId}#interactions` },
            { label: 'Offres', href: `/app/pro/${businessId}/prospects/${prospectId}#offers` },
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
