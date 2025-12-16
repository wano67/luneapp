// src/app/app/pro/[businessId]/prospects/[prospectId]/page.tsx
'use client';

import { useEffect, useRef, useState, type FormEvent, type ChangeEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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

const PIPELINE_ORDER: ProspectPipelineStatus[] = [
  'NEW',
  'IN_DISCUSSION',
  'OFFER_SENT',
  'FOLLOW_UP',
  'CLOSED',
];

const sourceOptions: { value: LeadSource; label: string }[] = [
  { value: 'UNKNOWN', label: 'Inconnu' },
  { value: 'INBOUND', label: 'Inbound' },
  { value: 'OUTBOUND', label: 'Outbound' },
  { value: 'REFERRAL', label: 'Recommandation' },
  { value: 'OTHER', label: 'Autre' },
];

const qualificationOptions: { value: QualificationLevel; label: string }[] = [
  { value: 'COLD', label: 'Cold' },
  { value: 'WARM', label: 'Warm' },
  { value: 'HOT', label: 'Hot' },
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

function withRef(message: string, ref?: string | null) {
  return ref ? `${message} (Ref: ${ref})` : message;
}

export default function ProspectDetailPage() {
  const params = useParams();
  const router = useRouter();

  const businessId = (params?.businessId ?? '') as string;
  const prospectId = (params?.prospectId ?? '') as string;

  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pipelineSaving, setPipelineSaving] = useState(false);
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [headerError, setHeaderError] = useState<string | null>(null);

  const [dealProbability, setDealProbability] = useState<number | ''>('');
  const [estimatedBudgetInput, setEstimatedBudgetInput] = useState<string>('');
  const [deadlineNote, setDeadlineNote] = useState('');
  const [convertOpen, setConvertOpen] = useState(false);

  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [interestNote, setInterestNote] = useState('');
  const [projectIdea, setProjectIdea] = useState('');
  const [source, setSource] = useState<LeadSource>('UNKNOWN');
  const [qualification, setQualification] = useState<QualificationLevel>('COLD');

  const fetchController = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!prospect) return;
    setName(prospect.name);
    setContactName(prospect.contactName ?? '');
    setContactEmail(prospect.contactEmail ?? '');
    setContactPhone(prospect.contactPhone ?? '');
    setInterestNote(prospect.interestNote ?? '');
    setProjectIdea(prospect.projectIdea ?? '');
    setSource(prospect.source ?? 'UNKNOWN');
    setQualification(prospect.qualificationLevel ?? 'COLD');
    setEstimatedBudgetInput(
      prospect.estimatedBudget != null ? prospect.estimatedBudget.toString() : ''
    );
    if (dealProbability === '') setDealProbability(50);
  }, [prospect, dealProbability]);

  async function loadProspect(signal?: AbortSignal) {
    const controller = signal ? null : new AbortController();
    const effectiveSignal = signal ?? controller?.signal;

    if (controller) {
      fetchController.current?.abort();
      fetchController.current = controller;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetchJson<Prospect>(
        `/api/pro/businesses/${businessId}/prospects/${prospectId}`,
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
        setError(withRef(res.error ?? 'Prospect introuvable.', res.requestId));
        setProspect(null);
        return;
      }

      setProspect(res.data);
    } catch (err) {
      if (effectiveSignal?.aborted) return;
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      if (!effectiveSignal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    void loadProspect();
    return () => fetchController.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, prospectId]);

  async function handlePipelineChange(nextStatus: ProspectPipelineStatus) {
    if (!prospect) return;
    setPipelineSaving(true);
    setHeaderError(null);

    try {
      const res = await fetchJson<Prospect>(
        `/api/pro/businesses/${businessId}/prospects/${prospectId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pipelineStatus: nextStatus }),
        }
      );

      if (!res.ok || !res.data) {
        setHeaderError(
          withRef(res.error ?? 'Impossible de mettre à jour le pipeline.', res.requestId)
        );
        return;
      }

      await loadProspect();
    } catch (err) {
      console.error(err);
      setHeaderError(getErrorMessage(err));
    } finally {
      setPipelineSaving(false);
    }
  }

  async function handleBudgetSave() {
    if (!prospect) return;
    setPipelineSaving(true);
    setHeaderError(null);

    const parsed = estimatedBudgetInput.trim() ? Number(estimatedBudgetInput) : null;
    if (parsed != null && (!Number.isFinite(parsed) || parsed < 0)) {
      setHeaderError('Budget estimé invalide.');
      setPipelineSaving(false);
      return;
    }

    try {
      const res = await fetchJson<Prospect>(
        `/api/pro/businesses/${businessId}/prospects/${prospectId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            estimatedBudget: parsed,
          }),
        }
      );

      if (!res.ok || !res.data) {
        setHeaderError(
          withRef(res.error ?? 'Impossible de sauvegarder le budget.', res.requestId)
        );
        return;
      }

      await loadProspect();
    } catch (err) {
      console.error(err);
      setHeaderError(getErrorMessage(err));
    } finally {
      setPipelineSaving(false);
    }
  }

  async function handleInfoSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInfoSaving(true);
    setInfoError(null);

    try {
      const res = await fetchJson<Prospect>(
        `/api/pro/businesses/${businessId}/prospects/${prospectId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            contactName: contactName.trim(),
            contactEmail: contactEmail.trim(),
            contactPhone: contactPhone.trim(),
            interestNote: interestNote.trim(),
            projectIdea: projectIdea.trim(),
            source,
            qualificationLevel: qualification,
          }),
        }
      );

      if (!res.ok || !res.data) {
        setInfoError(
          withRef(res.error ?? 'Impossible de mettre à jour le prospect.', res.requestId)
        );
        return;
      }

      await loadProspect();
    } catch (err) {
      console.error(err);
      setInfoError(getErrorMessage(err));
    } finally {
      setInfoSaving(false);
    }
  }

  async function handleDelete() {
    if (!prospect) return;
    const confirmed = window.confirm(
      'Supprimer ce prospect ? Cette action est définitive.'
    );
    if (!confirmed) return;

    setPipelineSaving(true);
    setHeaderError(null);

    try {
      const res = await fetchJson<null>(
        `/api/pro/businesses/${businessId}/prospects/${prospectId}`,
        { method: 'DELETE' }
      );

      if (!res.ok) {
        setHeaderError(
          withRef(res.error ?? 'Suppression impossible pour le moment.', res.requestId)
        );
        return;
      }

      router.push(`/app/pro/${businessId}/prospects`);
    } catch (err) {
      console.error(err);
      setHeaderError(getErrorMessage(err));
    } finally {
      setPipelineSaving(false);
    }
  }

  const currentStatus = prospect?.pipelineStatus ?? 'NEW';
  const nextStatus =
    PIPELINE_ORDER[PIPELINE_ORDER.indexOf(currentStatus) + 1] ?? currentStatus;

  if (loading) {
    return (
      <Card className="p-5">
        <p className="text-sm text-[var(--text-secondary)]">Chargement du prospect…</p>
      </Card>
    );
  }

  if (error || !prospect) {
    return (
      <Card className="space-y-3 p-5">
        <p className="text-sm font-semibold text-rose-400">{error ?? 'Prospect introuvable.'}</p>
        <Button variant="outline" size="sm" onClick={() => router.refresh()}>
          Recharger
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/app/pro/${businessId}/prospects`}>Retour à la liste</Link>
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
              Prospect · Centre de pilotage
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold text-[var(--text-primary)]">{prospect.name}</h1>
              <Badge variant="neutral">{statusLabel(prospect.pipelineStatus)}</Badge>
              <Badge variant="neutral">ID {prospect.id}</Badge>
            </div>
            {headerError ? (
              <p className="text-sm text-rose-400">{headerError}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setConvertOpen(true)}>
              Convertir en client + projet
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDelete} disabled={pipelineSaving}>
              Supprimer
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-2">
            <span className="text-xs font-medium text-[var(--text-secondary)]">Statut pipeline</span>
            <select
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
              value={prospect.pipelineStatus}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                handlePipelineChange(e.target.value as ProspectPipelineStatus)
              }
              disabled={pipelineSaving}
            >
              {PIPELINE_ORDER.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              Valeur estimée (€)
            </span>
            <div className="flex items-center gap-2">
              <input
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
                value={estimatedBudgetInput}
                onChange={(e) => setEstimatedBudgetInput(e.target.value)}
                placeholder="ex: 15000"
                inputMode="numeric"
              />
              <Button size="sm" variant="outline" onClick={handleBudgetSave} disabled={pipelineSaving}>
                Sauver
              </Button>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Actuel : {formatCurrency(prospect.estimatedBudget)}
            </p>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              Probabilité (%) — stub
            </span>
            <input
              className="w-full rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
              type="number"
              min={0}
              max={100}
              value={dealProbability}
              onChange={(e) => setDealProbability(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="50"
            />
            <p className="text-[10px] text-[var(--text-secondary)]">
              TODO API : ajouter un champ probability pour persister la donnée.
            </p>
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Card className="space-y-2 border-dashed border-[var(--border)] bg-transparent p-3">
            <p className="text-xs font-semibold text-[var(--text-primary)]">Owner</p>
            <p className="text-sm text-[var(--text-secondary)]">
              Assignation équipe à venir.
            </p>
            {/* TODO: relier au modèle d'équipe quand disponible */}
          </Card>

          <Card className="space-y-2 border-dashed border-[var(--border)] bg-transparent p-3">
            <p className="text-xs font-semibold text-[var(--text-primary)]">Prochaine étape</p>
            <Button
              size="sm"
              onClick={() => handlePipelineChange(nextStatus)}
              disabled={pipelineSaving || currentStatus === 'CLOSED'}
            >
              {currentStatus === 'CLOSED' ? 'Pipeline clôturé' : 'Passer à la suite'}
            </Button>
            <p className="text-[10px] text-[var(--text-secondary)]">
              Avance dans l’ordre {PIPELINE_ORDER.join(' → ')}.
            </p>
          </Card>

          <Card className="space-y-2 border-dashed border-[var(--border)] bg-transparent p-3">
            <p className="text-xs font-semibold text-[var(--text-primary)]">Gagné / perdu</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled>
                Marquer gagné
              </Button>
              <Button size="sm" variant="outline" disabled>
                Marquer perdu
              </Button>
            </div>
            <p className="text-[10px] text-[var(--text-secondary)]">
              TODO API : ajouter des statuts dédiés (WON/LOST) pour tracer l’issue.
            </p>
          </Card>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Infos prospect</p>
            <p className="text-xs text-[var(--text-secondary)]">
              Contact, qualification et note d’intérêt.
            </p>
          </div>
          <Badge variant="neutral">Contact</Badge>
        </div>

        <form onSubmit={handleInfoSubmit} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Nom du prospect" value={name} onChange={(e) => setName(e.target.value)} />
            <Input
              label="Contact (nom)"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
            <Input
              label="Email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
            <Input
              label="Téléphone"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-[var(--text-secondary)]">Source</span>
              <select
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
                value={source}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setSource(e.target.value as LeadSource)
                }
              >
                {sourceOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-[var(--text-secondary)]">
                Qualification
              </span>
              <select
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
                value={qualification}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setQualification(e.target.value as QualificationLevel)
                }
              >
                {qualificationOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="space-y-1">
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              Besoin exprimé / note
            </span>
            <textarea
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400/60"
              rows={3}
              value={interestNote}
              onChange={(e) => setInterestNote(e.target.value)}
              placeholder="Notes sur le besoin, contexte, urgence…"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              Idée de projet / intérêt
            </span>
            <textarea
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400/60"
              rows={3}
              value={projectIdea}
              onChange={(e) => setProjectIdea(e.target.value)}
              placeholder="Ex: refonte site, campagne SEO, branding…"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              Deadline souhaitée — stub
            </span>
            <Input
              placeholder="Q4, date précise…"
              value={deadlineNote}
              onChange={(e) => setDeadlineNote(e.target.value)}
            />
            <p className="text-[10px] text-[var(--text-secondary)]">
              TODO: ajouter un champ deadline côté modèle/API pour persister.
            </p>
          </label>

          {infoError ? <p className="text-sm text-rose-400">{infoError}</p> : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push(`/app/pro/${businessId}/prospects`)}
            >
              Retour
            </Button>
            <Button type="submit" disabled={infoSaving}>
              {infoSaving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Historique & interactions — stub
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              Journaux d’appels, emails, notes et prochaine action.
            </p>
          </div>
          <Badge variant="neutral">Bientôt</Badge>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          Aucun historique pour l’instant. Le bloc sera connecté à une future API d’interactions.
        </p>
        <Button size="sm" variant="outline" disabled>
          Ajouter une note (désactivé)
        </Button>
        {/* TODO API future : POST /api/pro/businesses/{businessId}/prospects/{prospectId}/notes */}
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Offres & devis — stub</p>
            <p className="text-xs text-[var(--text-secondary)]">
              Les propositions envoyées seront listées ici.
            </p>
          </div>
          <Badge variant="neutral">À venir</Badge>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          TODO: connecter une API devis/quotes pour suivre les montants et signatures.
        </p>
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Décision — stub</p>
            <p className="text-xs text-[var(--text-secondary)]">
              Pourquoi gagné/perdu, feedback client, prochains pas.
            </p>
          </div>
          <Badge variant="neutral">Bientôt</Badge>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          TODO: champ feedback décision + liaison avec statuts gagnés/perdus.
        </p>
      </Card>

      <Modal
        open={convertOpen}
        onClose={() => setConvertOpen(false)}
        title="Conversion client + projet"
        description="Préparer la future conversion d’un prospect en client/projet."
      >
        <div className="space-y-3 text-sm text-[var(--text-secondary)]">
          <p>
            Cette action créera automatiquement un client et un projet liés à ce prospect.
            Elle sera disponible dès que l’API sera prête.
          </p>
          <p className="text-[10px]">
            TODO API: POST /api/pro/businesses/{'{businessId}'}/prospects/{'{prospectId}'}/convert
          </p>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setConvertOpen(false)}>
              Fermer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
