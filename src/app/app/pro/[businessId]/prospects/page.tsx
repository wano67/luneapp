'use client';

import { useEffect, useState, FormEvent, type ChangeEvent } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type ProspectPipelineStatus =
  | 'NEW'
  | 'IN_DISCUSSION'
  | 'OFFER_SENT'
  | 'FOLLOW_UP'
  | 'CLOSED';

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
  if (!level) return '-';
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

export default function BusinessProspectsPage() {
  const params = useParams();
  const businessId = params?.businessId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<ProspectPipelineStatus | 'ALL'>('ALL');

  // Formulaire de création rapide
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  async function loadProspects(options?: { signal?: AbortSignal }) {
    if (!businessId) return;
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'ALL') params.set('status', statusFilter);

      const res = await fetch(
        `/api/pro/businesses/${businessId}/prospects` +
          (params.toString() ? `?${params.toString()}` : ''),
        {
          credentials: 'include',
          signal: options?.signal,
        }
      );

      if (res.status === 401) {
        if (typeof window !== 'undefined') {
          window.location.href = `/login?from=/app/pro/${businessId}/prospects`;
        }
        return;
      }

      if (!res.ok) {
        const raw = await res.text().catch(() => '');
        console.error('loadProspects failed', {
          status: res.status,
          statusText: res.statusText,
          body: raw,
        });

        let message = 'Impossible de charger les prospects.';
        try {
          const parsed = raw ? (JSON.parse(raw) as { error?: string }) : {};
          if (parsed && typeof parsed.error === 'string') {
            message = parsed.error;
          }
        } catch {
          // ignore JSON parse errors
        }

        throw new Error(message);
      }

      const json = (await res.json()) as ProspectListResponse;
      setProspects(json.items);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.name === 'AbortError' ||
          err.message === 'signal is aborted without reason')
      ) {
        return;
      }
      console.error('loadProspects error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Une erreur est survenue lors du chargement des prospects.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadProspects({ signal: controller.signal });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, statusFilter]); // on ne met pas `search` ici pour éviter de spam l'API à chaque frappe

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

      const res = await fetch(`/api/pro/businesses/${businessId}/prospects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setCreateError(
          typeof json.error === 'string'
            ? json.error
            : 'Impossible de créer le prospect.'
        );
        return;
      }

      // Reset formulaire
      setName('');
      setContactName('');
      setContactEmail('');
      setContactPhone('');
      setCreateError(null);

      // Rechargement de la liste
      await loadProspects();
    } catch (err) {
      console.error(err);
      setCreateError(
        err instanceof Error
          ? err.message
          : 'Une erreur est survenue lors de la création.'
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* En-tête + filtres */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-50">
              Prospects
            </h1>
            <p className="text-sm text-slate-400">
              Suis les leads avant qu&apos;ils deviennent clients.
            </p>
          </div>
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
        </div>

        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col gap-2 md:flex-row md:items-center"
        >
          <Input
            label="Recherche"
            placeholder="Rechercher par nom..."
            value={search}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setSearch(e.target.value)
            }
          />
          <Button
            type="submit"
            size="sm"
            className="md:ml-2 md:w-auto w-full md:self-end"
          >
            Filtrer
          </Button>
        </form>
      </Card>

      {/* Formulaire de création rapide */}
      <Card className="p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-100">
          Ajouter un prospect
        </h2>
        <form
          onSubmit={handleCreateProspect}
          className="grid gap-3 md:grid-cols-4"
        >
          <Input
            label="Nom du prospect"
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setName(e.target.value)
            }
            placeholder="Entreprise ou personne"
            error={createError ?? undefined}
          />
          <Input
            label="Contact"
            value={contactName}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setContactName(e.target.value)
            }
            placeholder="Nom du contact"
          />
          <Input
            label="Email"
            type="email"
            value={contactEmail}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setContactEmail(e.target.value)
            }
            placeholder="contact@exemple.com"
          />
          <div className="flex flex-col gap-2 md:items-end md:justify-end">
            <Input
              label="Téléphone"
              value={contactPhone}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setContactPhone(e.target.value)
              }
              placeholder="+33..."
            />
            <Button
              type="submit"
              size="sm"
              className="w-full md:w-auto"
              disabled={creating}
            >
              {creating ? 'Création...' : 'Ajouter'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Liste des prospects */}
      <Card className="p-5">
        {loading ? (
          <p className="text-sm text-slate-400">Chargement des prospects…</p>
        ) : error ? (
          <div className="space-y-2">
            <p className="text-sm text-rose-400">{error}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => loadProspects()}
            >
              Réessayer
            </Button>
          </div>
        ) : prospects.length === 0 ? (
          <p className="text-sm text-slate-400">
            Aucun prospect pour le moment. Ajoute-en un avec le formulaire
            ci-dessus.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="hidden grid-cols-[2fr,1.5fr,1.5fr,1fr,1fr] gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400 md:grid">
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
                  className="grid gap-2 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 text-sm md:grid-cols-[2fr,1.5fr,1.5fr,1fr,1fr]"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-slate-50">{p.name}</p>
                    {p.projectIdea ? (
                      <p className="text-xs text-slate-500 line-clamp-2">
                        {p.projectIdea}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-1">
                    {p.contactName ? (
                      <p className="text-slate-200">{p.contactName}</p>
                    ) : (
                      <p className="text-slate-500 text-xs">Contact inconnu</p>
                    )}
                    <p className="text-xs text-slate-500">
                      {p.contactEmail || p.contactPhone || '—'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">
                      Source : {sourceLabel(p.source)}
                    </p>
                    <p className="text-xs text-slate-400">
                      Qualification : {qualificationLabel(p.qualificationLevel)}
                    </p>
                  </div>

                  <div className="flex items-center">
                    <Badge variant="neutral" className="text-[11px]">
                      {statusLabel(p.pipelineStatus)}
                    </Badge>
                  </div>

                  <div className="flex items-center text-xs text-slate-300">
                    {p.estimatedBudget
                      ? new Intl.NumberFormat('fr-FR', {
                          style: 'currency',
                          currency: 'EUR',
                          maximumFractionDigits: 0,
                        }).format(p.estimatedBudget)
                      : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
