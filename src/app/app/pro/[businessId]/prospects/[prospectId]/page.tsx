// Prospect detail page - premium, minimal
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { LogoAvatar } from '@/components/pro/LogoAvatar';
import { MoreVertical } from 'lucide-react';
import { PageHeaderPro } from '@/components/pro/PageHeaderPro';
import { TabsPills } from '@/components/pro/TabsPills';
import { useActiveBusiness } from '@/app/app/pro/ActiveBusinessProvider';

type Prospect = {
  id: string;
  name: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  websiteUrl?: string | null;
  pipelineStatus?: string | null;
  probability?: number | null;
  nextActionDate?: string | null;
  status?: string | null;
  interestNote?: string | null;
};

type ProspectResponse = Prospect;

type Interaction = { id: string; content?: string | null; happenedAt?: string | null; type?: string | null };
type InteractionsResponse = { items?: Interaction[] };
type ConvertResponse = { clientId: string; projectId: string };

const PIPELINE_OPTIONS = [
  { value: 'NEW', label: 'Nouveau' },
  { value: 'IN_DISCUSSION', label: 'En discussion' },
  { value: 'OFFER_SENT', label: 'Offre envoyée' },
  { value: 'FOLLOW_UP', label: 'Relance' },
  { value: 'CLOSED', label: 'Clôturé' },
];

const STATUS_OPTIONS = [
  { value: 'NEW', label: 'Nouveau' },
  { value: 'FOLLOW_UP', label: 'Relance' },
  { value: 'WON', label: 'Gagné' },
  { value: 'LOST', label: 'Perdu' },
];

const tabs = [
  { key: 'infos', label: 'Infos' },
  { key: 'interactions', label: 'Interactions' },
  { key: 'offers', label: 'Offres / Devis' },
];

export default function ProspectDetailPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const prospectId = (params?.prospectId ?? '') as string;
  const activeCtx = useActiveBusiness({ optional: true });
  const isAdmin = activeCtx?.isAdmin ?? false;
  const readOnlyMessage = 'Réservé aux admins/owners.';

  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'infos' | 'interactions' | 'offers'>('infos');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveInfo, setSaveInfo] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    interestNote: '',
    pipelineStatus: 'NEW',
    status: 'NEW',
    probability: 0,
    nextActionDate: '',
  });
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertName, setConvertName] = useState('');
  const [convertLoading, setConvertLoading] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [convertResult, setConvertResult] = useState<ConvertResponse | null>(null);

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

  useEffect(() => {
    if (!prospect) return;
    setForm({
      name: prospect.name ?? '',
      contactName: prospect.contactName ?? '',
      contactEmail: prospect.contactEmail ?? '',
      contactPhone: prospect.contactPhone ?? '',
      interestNote: prospect.interestNote ?? '',
      pipelineStatus: prospect.pipelineStatus ?? 'NEW',
      status: prospect.status ?? 'NEW',
      probability: typeof prospect.probability === 'number' ? prospect.probability : 0,
      nextActionDate: toDateInput(prospect.nextActionDate),
    });
  }, [prospect]);

  useEffect(() => {
    if (!convertOpen || !prospect) return;
    if (!convertName) {
      setConvertName(`Projet - ${prospect.name ?? 'Prospect'}`);
    }
  }, [convertName, convertOpen, prospect]);

  const lastInteraction = useMemo(() => {
    return (
      interactions
        .map((i) => i.happenedAt)
        .filter(Boolean)
        .sort()
        .slice(-1)[0] ?? null
    );
  }, [interactions]);

  const hasChanges = useMemo(() => {
    if (!prospect) return false;
    return (
      form.name !== (prospect.name ?? '') ||
      form.contactName !== (prospect.contactName ?? '') ||
      form.contactEmail !== (prospect.contactEmail ?? '') ||
      form.contactPhone !== (prospect.contactPhone ?? '') ||
      form.interestNote !== (prospect.interestNote ?? '') ||
      form.pipelineStatus !== (prospect.pipelineStatus ?? 'NEW') ||
      form.status !== (prospect.status ?? 'NEW') ||
      Number(form.probability) !== (prospect.probability ?? 0) ||
      form.nextActionDate !== toDateInput(prospect.nextActionDate)
    );
  }, [form, prospect]);

  async function handleSave() {
    if (!prospect) return;
    setSaveError(null);
    setSaveInfo(null);
    if (!isAdmin) {
      setSaveError(readOnlyMessage);
      return;
    }
    if (!form.name.trim()) {
      setSaveError('Le nom est requis.');
      return;
    }
    const probability = Number(form.probability);
    const payload = {
      name: form.name.trim(),
      contactName: form.contactName.trim() || null,
      contactEmail: form.contactEmail.trim() || null,
      contactPhone: form.contactPhone.trim() || null,
      interestNote: form.interestNote.trim() || null,
      pipelineStatus: form.pipelineStatus,
      status: form.status,
      probability: Number.isFinite(probability) ? Math.min(100, Math.max(0, Math.trunc(probability))) : 0,
      nextActionDate: form.nextActionDate ? new Date(form.nextActionDate).toISOString() : null,
    };
    try {
      setSaving(true);
      const res = await fetchJson<ProspectResponse>(
        `/api/pro/businesses/${businessId}/prospects/${prospectId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok || !res.data) {
        setSaveError(res.error ?? 'Enregistrement impossible');
        return;
      }
      setProspect(res.data);
      setSaveInfo('Enregistré');
      setEditing(false);
    } catch (err) {
      setSaveError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleConvert() {
    if (!prospect) return;
    setConvertError(null);
    setConvertResult(null);
    if (!isAdmin) {
      setConvertError(readOnlyMessage);
      return;
    }
    const payload = convertName.trim() ? { projectName: convertName.trim() } : {};
    try {
      setConvertLoading(true);
      const res = await fetchJson<ConvertResponse>(
        `/api/pro/businesses/${businessId}/prospects/${prospectId}/convert`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok || !res.data) {
        setConvertError(res.error ?? 'Conversion impossible');
        return;
      }
      setConvertResult(res.data);
      setProspect((prev) =>
        prev ? { ...prev, status: 'WON', pipelineStatus: 'CLOSED' } : prev
      );
    } catch (err) {
      setConvertError(getErrorMessage(err));
    } finally {
      setConvertLoading(false);
    }
  }

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
          href={`/app/pro/${businessId}/prospects`}
          className="text-sm text-[var(--text-secondary)] underline-offset-4 hover:text-[var(--text-primary)]"
        >
          ← Retour aux prospects
        </Link>
        <Card className="p-4 text-sm text-rose-500">{error ?? 'Prospect introuvable'}</Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <div className="flex justify-end">
        <Link
          href={`/app/pro/${businessId}/agenda?prospectId=${prospectId}`}
          className="text-xs font-semibold text-[var(--text-secondary)] underline underline-offset-4 transition hover:text-[var(--text-primary)]"
        >
          Ouvrir dans le CRM
        </Link>
      </div>
      <PageHeaderPro
        backHref={`/app/pro/${businessId}/prospects`}
        backLabel="Prospects"
        title={prospect.name || 'Prospect'}
        subtitle={
          <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
            {prospect.contactEmail ? <span className="truncate">{prospect.contactEmail}</span> : null}
            {prospect.websiteUrl ? <span className="truncate">{prospect.websiteUrl}</span> : null}
            <StatusIndicatorProspect />
          </div>
        }
        leading={<LogoAvatar name={prospect.name || 'Prospect'} websiteUrl={prospect.websiteUrl ?? undefined} size={48} />}
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                setConvertError(null);
                setConvertResult(null);
                setConvertOpen(true);
              }}
              className="w-full cursor-pointer rounded-md bg-neutral-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              disabled={!isAdmin}
            >
              Convertir en client + projet
            </button>
            <MenuDots businessId={businessId} prospectId={prospectId} />
          </>
        }
      />

      <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Statut pipeline" value={prospect.pipelineStatus ?? 'Non défini'} />
          <Metric label="Probabilité" value={prospect.probability ? `${prospect.probability}%` : '0%'} />
          <Metric label="Prochaine action" value={formatDate(prospect.nextActionDate)} />
          <Metric label="Dernière interaction" value={formatDate(lastInteraction)} />
        </div>
      </Card>

      <TabsPills
        items={tabs}
        value={activeTab}
        onChange={(key) => setActiveTab(key as typeof activeTab)}
        ariaLabel="Sections prospect"
        className="-mx-1 px-1"
      />

      {activeTab === 'infos' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Informations prospect</p>
              <p className="text-xs text-[var(--text-secondary)]">Coordonnées et pipeline</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
              {editing ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (!prospect) return;
                      setForm({
                        name: prospect.name ?? '',
                        contactName: prospect.contactName ?? '',
                        contactEmail: prospect.contactEmail ?? '',
                        contactPhone: prospect.contactPhone ?? '',
                        interestNote: prospect.interestNote ?? '',
                        pipelineStatus: prospect.pipelineStatus ?? 'NEW',
                        status: prospect.status ?? 'NEW',
                        probability: typeof prospect.probability === 'number' ? prospect.probability : 0,
                        nextActionDate: toDateInput(prospect.nextActionDate),
                      });
                      setEditing(false);
                      setSaveError(null);
                      setSaveInfo(null);
                    }}
                    className="w-full cursor-pointer rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] sm:w-auto"
                    disabled={!isAdmin}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="w-full cursor-pointer rounded-md bg-neutral-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    disabled={!hasChanges || saving || !isAdmin}
                  >
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="w-full cursor-pointer rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] sm:w-auto"
                  disabled={!isAdmin}
                >
                  Modifier
                </button>
              )}
            </div>
          </div>

          {saveError ? <p className="text-sm text-rose-500">{saveError}</p> : null}
          {saveInfo ? <p className="text-sm text-emerald-500">{saveInfo}</p> : null}
          {!isAdmin ? <p className="text-xs text-[var(--text-secondary)]">{readOnlyMessage}</p> : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Contact</p>
              {editing ? (
                <div className="mt-3 space-y-3">
                  <Input
                    label="Nom"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    disabled={!isAdmin}
                  />
                  <Input
                    label="Contact"
                    value={form.contactName}
                    onChange={(e) => setForm((prev) => ({ ...prev, contactName: e.target.value }))}
                    disabled={!isAdmin}
                  />
                  <Input
                    label="Email"
                    value={form.contactEmail}
                    onChange={(e) => setForm((prev) => ({ ...prev, contactEmail: e.target.value }))}
                    disabled={!isAdmin}
                  />
                  <Input
                    label="Téléphone"
                    value={form.contactPhone}
                    onChange={(e) => setForm((prev) => ({ ...prev, contactPhone: e.target.value }))}
                    disabled={!isAdmin}
                  />
                </div>
              ) : (
                <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                  <InfoRow label="Nom" value={prospect.name ?? '—'} />
                  <InfoRow label="Contact" value={prospect.contactName ?? 'Non renseigné'} />
                  <InfoRow label="Email" value={prospect.contactEmail ?? 'Non renseigné'} />
                  <InfoRow label="Téléphone" value={prospect.contactPhone ?? 'Non renseigné'} />
                </div>
              )}
            </Card>

            <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Pipeline</p>
              {editing ? (
                <div className="mt-3 space-y-3">
                  <label className="space-y-1 text-sm text-[var(--text-primary)]">
                    <span className="text-xs text-[var(--text-secondary)]">Statut pipeline</span>
                    <select
                      value={form.pipelineStatus}
                      onChange={(e) => setForm((prev) => ({ ...prev, pipelineStatus: e.target.value }))}
                      className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                      disabled={!isAdmin}
                    >
                      {PIPELINE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm text-[var(--text-primary)]">
                    <span className="text-xs text-[var(--text-secondary)]">Statut</span>
                    <select
                      value={form.status}
                      onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                      className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                      disabled={!isAdmin}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Input
                    label="Probabilité (%)"
                    type="number"
                    min={0}
                    max={100}
                    value={form.probability}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, probability: Number(e.target.value || 0) }))
                    }
                    disabled={!isAdmin}
                  />
                  <Input
                    label="Prochaine action"
                    type="date"
                    value={form.nextActionDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, nextActionDate: e.target.value }))}
                    disabled={!isAdmin}
                  />
                </div>
              ) : (
                <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                  <InfoRow
                    label="Pipeline"
                    value={
                      PIPELINE_OPTIONS.find((opt) => opt.value === (prospect.pipelineStatus ?? 'NEW'))?.label ??
                      'Non défini'
                    }
                  />
                  <InfoRow
                    label="Statut"
                    value={STATUS_OPTIONS.find((opt) => opt.value === (prospect.status ?? 'NEW'))?.label ?? 'Nouveau'}
                  />
                  <InfoRow label="Probabilité" value={`${prospect.probability ?? 0}%`} />
                  <InfoRow label="Prochaine action" value={formatDate(prospect.nextActionDate)} />
                </div>
              )}
            </Card>

            <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:col-span-2">
              <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Notes</p>
              {editing ? (
                <label className="mt-3 flex flex-col gap-1 text-sm text-[var(--text-primary)]">
                  <span className="text-xs text-[var(--text-secondary)]">Notes</span>
                  <textarea
                    rows={4}
                    value={form.interestNote}
                    onChange={(e) => setForm((prev) => ({ ...prev, interestNote: e.target.value }))}
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                    disabled={!isAdmin}
                  />
                </label>
              ) : (
                <p className="mt-3 rounded-xl bg-[var(--surface-hover)]/60 px-3 py-2 text-sm text-[var(--text-primary)]">
                  {prospect.interestNote ?? '—'}
                </p>
              )}
            </Card>
          </div>
        </div>
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

      <Modal
        open={convertOpen}
        onCloseAction={() => (!convertLoading ? setConvertOpen(false) : null)}
        title="Convertir le prospect"
        description="Crée un client et un projet depuis ce prospect."
      >
        <div className="space-y-4">
          <Input
            label="Nom du projet"
            value={convertName}
            onChange={(e) => setConvertName(e.target.value)}
            disabled={!isAdmin || convertLoading}
          />
          {convertError ? <p className="text-xs text-rose-500">{convertError}</p> : null}
          {convertResult ? (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-700">
              Conversion réussie.
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  href={`/app/pro/${businessId}/projects/${convertResult.projectId}`}
                  className="text-xs font-semibold underline underline-offset-4"
                >
                  Ouvrir le projet
                </Link>
                <Link
                  href={`/app/pro/${businessId}/agenda?clientId=${convertResult.clientId}`}
                  className="text-xs font-semibold underline underline-offset-4"
                >
                  Ouvrir dans l’agenda
                </Link>
              </div>
            </div>
          ) : null}
          {!isAdmin ? <p className="text-xs text-[var(--text-secondary)]">{readOnlyMessage}</p> : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConvertOpen(false)}
              className="cursor-pointer rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              disabled={convertLoading}
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={handleConvert}
              className="cursor-pointer rounded-md bg-neutral-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!isAdmin || convertLoading}
            >
              {convertLoading ? 'Conversion…' : 'Convertir'}
            </button>
          </div>
        </div>
      </Modal>
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

function toDateInput(value: string | null | undefined) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
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
