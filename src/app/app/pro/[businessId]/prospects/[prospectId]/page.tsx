// src/app/app/pro/[businessId]/prospects/[prospectId]/page.tsx
'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';

type ProspectStatus = 'NEW' | 'FOLLOW_UP' | 'WON' | 'LOST';
type ProspectPipelineStatus = 'NEW' | 'IN_DISCUSSION' | 'OFFER_SENT' | 'FOLLOW_UP' | 'CLOSED';

type Prospect = {
  id: string;
  businessId: string;
  name: string;
  title: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  probability: number;
  nextActionDate: string | null;
  pipelineStatus: ProspectPipelineStatus;
  status: ProspectStatus;
  createdAt: string;
  updatedAt: string;
};

type ConvertResponse = { clientId: string; projectId: string };

const pipelineOptions: { value: ProspectPipelineStatus; label: string }[] = [
  { value: 'NEW', label: 'Nouveau' },
  { value: 'IN_DISCUSSION', label: 'En discussion' },
  { value: 'OFFER_SENT', label: 'Devis envoyé' },
  { value: 'FOLLOW_UP', label: 'Relance' },
  { value: 'CLOSED', label: 'Fermé' },
];

const statusOptions: { value: ProspectStatus; label: string }[] = [
  { value: 'NEW', label: 'Nouveau' },
  { value: 'FOLLOW_UP', label: 'Suivi' },
  { value: 'WON', label: 'Gagné' },
  { value: 'LOST', label: 'Perdu' },
];

function formatDate(value: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value));
  } catch {
    return value;
  }
}

function withRef(message: string, ref?: string | null) {
  return ref ? `${message} (Ref: ${ref})` : message;
}

function probabilityLabel(value: number | null | undefined) {
  if (value == null) return '—';
  return `${value}%`;
}

export default function ProspectDetailPage() {
  const params = useParams();
  const router = useRouter();

  const businessId = (params?.businessId ?? '') as string;
  const prospectId = (params?.prospectId ?? '') as string;

  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    title: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    probability: '',
    pipelineStatus: 'NEW' as ProspectPipelineStatus,
    status: 'NEW' as ProspectStatus,
    nextActionDate: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [convertOpen, setConvertOpen] = useState(false);
  const [convertLoading, setConvertLoading] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');

  const fetchController = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!prospect) return;
    setForm({
      name: prospect.name,
      title: prospect.title ?? '',
      contactName: prospect.contactName ?? '',
      contactEmail: prospect.contactEmail ?? '',
      contactPhone: prospect.contactPhone ?? '',
      probability: String(prospect.probability ?? ''),
      pipelineStatus: prospect.pipelineStatus,
      status: prospect.status,
      nextActionDate: prospect.nextActionDate
        ? new Date(prospect.nextActionDate).toISOString().slice(0, 16)
        : '',
    });
  }, [prospect]);

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
      setRequestId(null);

      const res = await fetchJson<Prospect>(
        `/api/pro/businesses/${businessId}/prospects/${prospectId}`,
        {},
        effectiveSignal
      );
      if (effectiveSignal?.aborted) return;

      setRequestId(res.requestId);
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

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!prospect) return;
    setSaving(true);
    setFormError(null);
    setRequestId(null);

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      title: form.title.trim() || null,
      contactName: form.contactName.trim() || null,
      contactEmail: form.contactEmail.trim() || null,
      contactPhone: form.contactPhone.trim() || null,
      pipelineStatus: form.pipelineStatus,
      status: form.status,
      probability: form.probability ? Number(form.probability) : null,
      nextActionDate: form.nextActionDate ? new Date(form.nextActionDate).toISOString() : null,
    };

    const res = await fetchJson<Prospect>(
      `/api/pro/businesses/${businessId}/prospects/${prospectId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    setRequestId(res.requestId);

    if (!res.ok || !res.data) {
      const msg = res.error ?? 'Mise à jour impossible.';
      setFormError(withRef(msg, res.requestId));
      setSaving(false);
      return;
    }

    setSaving(false);
    await loadProspect();
  }

  async function handleConvert() {
    setConvertLoading(true);
    setConvertError(null);
    const payload: Record<string, unknown> = {};
    if (projectName.trim()) payload.projectName = projectName.trim();

    const res = await fetchJson<ConvertResponse>(
      `/api/pro/businesses/${businessId}/prospects/${prospectId}/convert`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    setRequestId(res.requestId);

    if (!res.ok || !res.data) {
      const msg = res.error ?? 'Conversion impossible.';
      setConvertError(withRef(msg, res.requestId));
      setConvertLoading(false);
      return;
    }

    setConvertLoading(false);
    setConvertOpen(false);
    const { projectId, clientId } = res.data;
    if (projectId) {
      router.push(`/app/pro/${businessId}/projects/${projectId}`);
    } else if (clientId) {
      router.push(`/app/pro/${businessId}/clients/${clientId}`);
    } else {
      router.push(`/app/pro/${businessId}/clients`);
    }
  }

  if (loading) {
    return (
      <Card className="p-5">
        <p className="text-sm text-[var(--text-secondary)]">Chargement du prospect…</p>
      </Card>
    );
  }

  if (!prospect) {
    return (
      <Card className="space-y-3 p-5">
        <p className="text-sm font-semibold text-rose-500">{error ?? 'Prospect introuvable.'}</p>
        <Button variant="outline" asChild>
          <Link href={`/app/pro/${businessId}/prospects`}>Retour au pipeline</Link>
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
              Prospect · fiche
            </p>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">{prospect.name}</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Contact : {prospect.contactName ?? '—'} · {prospect.contactEmail ?? prospect.contactPhone ?? '—'}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge variant="neutral">{prospect.pipelineStatus}</Badge>
              <Badge variant="neutral">{prospect.status}</Badge>
              <Badge variant="neutral">{probabilityLabel(prospect.probability)}</Badge>
            </div>
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <Button onClick={() => setConvertOpen(true)}>Convertir en client</Button>
            <p className="text-[10px] text-[var(--text-secondary)]">
              Prochaine action : {formatDate(prospect.nextActionDate)}
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Créé le</p>
            <p className="text-sm text-[var(--text-primary)]">{formatDate(prospect.createdAt)}</p>
          </Card>
          <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Titre</p>
            <p className="text-sm text-[var(--text-primary)]">{prospect.title || '—'}</p>
          </Card>
          <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Prochaine action</p>
            <p className="text-sm text-[var(--text-primary)]">{formatDate(prospect.nextActionDate)}</p>
          </Card>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Infos prospect</p>
          {requestId ? (
            <span className="text-[10px] text-[var(--text-faint)]">Req: {requestId}</span>
          ) : null}
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Entreprise"
              required
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
            <Input
              label="Titre / rôle"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            />
            <Input
              label="Contact"
              value={form.contactName}
              onChange={(e) => setForm((prev) => ({ ...prev, contactName: e.target.value }))}
            />
            <Input
              label="Email"
              type="email"
              value={form.contactEmail}
              onChange={(e) => setForm((prev) => ({ ...prev, contactEmail: e.target.value }))}
            />
            <Input
              label="Téléphone"
              value={form.contactPhone}
              onChange={(e) => setForm((prev) => ({ ...prev, contactPhone: e.target.value }))}
            />
            <Input
              label="Probabilité (%)"
              type="number"
              inputMode="numeric"
              value={form.probability}
              onChange={(e) => setForm((prev) => ({ ...prev, probability: e.target.value }))}
            />
            <Select
              label="Pipeline"
              value={form.pipelineStatus}
              onChange={(e) => setForm((prev) => ({ ...prev, pipelineStatus: e.target.value as ProspectPipelineStatus }))}
            >
              {pipelineOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Select
              label="Statut"
              value={form.status}
              onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as ProspectStatus }))}
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Input
              label="Prochaine action"
              type="datetime-local"
              value={form.nextActionDate}
              onChange={(e) => setForm((prev) => ({ ...prev, nextActionDate: e.target.value }))}
            />
          </div>
          {formError ? <p className="text-sm font-semibold text-rose-500">{formError}</p> : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="submit" variant="outline" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Mettre à jour'}
            </Button>
          </div>
        </form>
      </Card>

      <Modal
        open={convertOpen}
        onCloseAction={() => {
          if (convertLoading) return;
          setConvertOpen(false);
        }}
        title="Convertir en client + projet"
        description="Un client et un projet seront créés à partir de ce prospect."
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Confirme pour créer un client et un projet liés. Tu pourras ensuite démarrer et suivre les tâches.
          </p>
          <Input
            label="Nom du projet (optionnel)"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder={prospect.name}
          />
          {convertError ? <p className="text-sm font-semibold text-rose-500">{convertError}</p> : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setConvertOpen(false)} disabled={convertLoading}>
              Annuler
            </Button>
            <Button onClick={handleConvert} disabled={convertLoading}>
              {convertLoading ? 'Conversion…' : 'Convertir en client'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
