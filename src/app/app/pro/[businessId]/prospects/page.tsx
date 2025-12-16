// src/app/app/pro/[businessId]/prospects/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent, type ChangeEvent } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';

type ProspectPipelineStatus = 'NEW' | 'IN_DISCUSSION' | 'OFFER_SENT' | 'FOLLOW_UP' | 'CLOSED';
type LeadSource = 'UNKNOWN' | 'OUTBOUND' | 'INBOUND' | 'REFERRAL' | 'OTHER';
type QualificationLevel = 'COLD' | 'WARM' | 'HOT';

type Prospect = {
  id: string;
  businessId: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  source: LeadSource | null;
  interestNote: string | null;
  qualificationLevel: QualificationLevel | null;
  projectIdea: string | null;
  estimatedBudget: number | null;
  firstContactAt: string | null;
  pipelineStatus: ProspectPipelineStatus;
  createdAt: string;
  updatedAt: string;
};

type ProspectListResponse = {
  items: Prospect[];
};

const statusOptions: { value: ProspectPipelineStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Tous' },
  { value: 'NEW', label: 'Nouveau' },
  { value: 'IN_DISCUSSION', label: 'En discussion' },
  { value: 'OFFER_SENT', label: 'Devis envoyé' },
  { value: 'FOLLOW_UP', label: 'Relance' },
  { value: 'CLOSED', label: 'Fermé' },
];

function statusLabel(status: ProspectPipelineStatus) {
  switch (status) {
    case 'NEW':
      return 'Nouveau';
    case 'IN_DISCUSSION':
      return 'En discussion';
    case 'OFFER_SENT':
      return 'Devis envoyé';
    case 'FOLLOW_UP':
      return 'Relance';
    case 'CLOSED':
      return 'Fermé';
    default:
      return status;
  }
}

function sourceLabel(source: LeadSource | null) {
  if (!source) return 'Inconnu';
  switch (source) {
    case 'OUTBOUND':
      return 'Outbound';
    case 'INBOUND':
      return 'Inbound';
    case 'REFERRAL':
      return 'Recommandation';
    case 'OTHER':
      return 'Autre';
    case 'UNKNOWN':
    default:
      return 'Inconnu';
  }
}

function qualificationLabel(level: QualificationLevel | null) {
  if (!level) return '—';
  switch (level) {
    case 'COLD':
      return 'Cold';
    case 'WARM':
      return 'Warm';
    case 'HOT':
      return 'Hot';
    default:
      return level;
  }
}

function formatCurrency(value: number | null) {
  if (value == null) return '—';
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value} €`;
  }
}

export default function BusinessProspectsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const businessId = (params?.businessId ?? '') as string;

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProspectPipelineStatus | 'ALL'>('ALL');

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  const fetchController = useRef<AbortController | null>(null);

  const filteredCount = prospects.length;

  useEffect(() => {
    if (searchParams?.get('new') === '1') {
      setCreateOpen(true);
      router.replace(`/app/pro/${businessId}/prospects`);
    }
  }, [businessId, router, searchParams]);

  async function loadProspects(signal?: AbortSignal) {
    const controller = signal ? null : new AbortController();
    const effectiveSignal = signal ?? controller?.signal;

    if (controller) {
      fetchController.current?.abort();
      fetchController.current = controller;
    }

    try {
      setLoading(true);
      setError(null);

      const paramsQuery = new URLSearchParams();
      if (search.trim()) paramsQuery.set('search', search.trim());
      if (statusFilter !== 'ALL') paramsQuery.set('status', statusFilter);

      const res = await fetchJson<ProspectListResponse>(
        `/api/pro/businesses/${businessId}/prospects${
          paramsQuery.toString() ? `?${paramsQuery.toString()}` : ''
        }`,
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
        const ref = res.requestId;
        const msg = res.error ?? 'Impossible de charger les prospects.';
        setError(ref ? `${msg} (Ref: ${ref})` : msg);
        setProspects([]);
        return;
      }

      setProspects(res.data.items);
    } catch (err) {
      if (effectiveSignal?.aborted) return;
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      if (!effectiveSignal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    void loadProspects();
    return () => fetchController.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, statusFilter]);

  async function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadProspects();
  }

  async function handleCreateProspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setCreateError("Merci d'indiquer un nom de prospect.");
      return;
    }

    try {
      setCreating(true);
      const body: Record<string, unknown> = {
        name: trimmedName,
      };

      if (contactName.trim()) body.contactName = contactName.trim();
      if (contactEmail.trim()) body.contactEmail = contactEmail.trim();
      if (contactPhone.trim()) body.contactPhone = contactPhone.trim();

      const res = await fetchJson<Prospect>(`/api/pro/businesses/${businessId}/prospects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok || !res.data) {
        const ref = res.requestId;
        const msg = res.error ?? 'Impossible de créer le prospect.';
        setCreateError(ref ? `${msg} (Ref: ${ref})` : msg);
        return;
      }

      setName('');
      setContactName('');
      setContactEmail('');
      setContactPhone('');
      setCreateOpen(false);
      await loadProspects();
    } catch (err) {
      console.error(err);
      setCreateError(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
              Pro · Prospects
            </p>
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">Pipeline prospects</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Explore, filtre et passe en revue tes leads avant conversion.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>Créer un prospect</Button>
        </div>

        <form
          onSubmit={handleSearchSubmit}
          className="grid gap-3 md:grid-cols-[1fr,auto] md:items-end"
        >
          <Input
            label="Recherche"
            placeholder="Rechercher par nom..."
            value={search}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  size="sm"
                  variant={statusFilter === opt.value ? 'primary' : 'outline'}
                  onClick={() => setStatusFilter(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            <Button type="submit" size="sm" className="md:self-center">
              Filtrer
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-5">
        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Chargement des prospects…</p>
        ) : error ? (
          <div className="space-y-2">
            <p className="text-sm text-rose-400">{error}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => loadProspects()}>
              Réessayer
            </Button>
          </div>
        ) : filteredCount === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">
              Aucun prospect pour le moment. Crée un lead ou ajuste les filtres.
            </p>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Créer un prospect
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="hidden grid-cols-[2fr,1.5fr,1.5fr,1fr,1fr] gap-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] md:grid">
              <span>Prospect</span>
              <span>Contact</span>
              <span>Source & qualification</span>
              <span>Pipeline</span>
              <span>Budget est.</span>
            </div>

            <div className="space-y-2">
              {prospects.map((p) => (
                <div
                  key={p.id}
                  className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-3 text-sm md:grid-cols-[2fr,1.5fr,1.5fr,1fr,1fr]"
                >
                  <div className="space-y-1">
                    <Link
                      className="font-semibold text-[var(--text-primary)] hover:underline"
                      href={`/app/pro/${businessId}/prospects/${p.id}`}
                    >
                      {p.name}
                    </Link>
                    {p.projectIdea ? (
                      <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                        {p.projectIdea}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-1">
                    {p.contactName ? (
                      <p className="text-[var(--text-primary)]">{p.contactName}</p>
                    ) : (
                      <p className="text-xs text-[var(--text-secondary)]">Contact inconnu</p>
                    )}
                    <p className="text-xs text-[var(--text-secondary)]">
                      {p.contactEmail || p.contactPhone || '—'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-[var(--text-secondary)]">
                      Source : {sourceLabel(p.source)}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Qualification : {qualificationLabel(p.qualificationLevel)}
                    </p>
                  </div>

                  <div className="flex items-center">
                    <Badge variant="neutral" className="text-[11px]">
                      {statusLabel(p.pipelineStatus)}
                    </Badge>
                  </div>

                  <div className="flex items-center text-xs text-[var(--text-primary)]">
                    {formatCurrency(p.estimatedBudget)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Modal
        open={createOpen}
        onClose={() => (!creating ? setCreateOpen(false) : null)}
        title="Créer un prospect"
        description="Ajoute rapidement un lead dans le pipeline."
      >
        <form onSubmit={handleCreateProspect} className="space-y-4">
          <Input
            label="Nom du prospect *"
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            placeholder="Entreprise ou personne"
            error={createError ?? undefined}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Contact (nom)"
              value={contactName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setContactName(e.target.value)}
              placeholder="Nom du contact"
            />
            <Input
              label="Téléphone"
              value={contactPhone}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setContactPhone(e.target.value)}
              placeholder="+33..."
            />
            <Input
              label="Email"
              type="email"
              value={contactEmail}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setContactEmail(e.target.value)}
              placeholder="contact@exemple.com"
              className="md:col-span-2"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? 'Création…' : 'Créer'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
