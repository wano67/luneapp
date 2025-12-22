// src/app/app/pro/[businessId]/prospects/page.tsx
'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { useActiveBusiness } from '../../ActiveBusinessProvider';
import RoleBanner from '@/components/RoleBanner';

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
  pipelineStatus: ProspectPipelineStatus;
  status: ProspectStatus;
  probability: number;
  nextActionDate: string | null;
  createdAt: string;
  updatedAt: string;
};

type ProspectListResponse = { items: Prospect[] };

type ProspectForm = {
  name: string;
  title: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  probability: string;
  nextActionDate: string;
};

const emptyForm: ProspectForm = {
  name: '',
  title: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  probability: '',
  nextActionDate: '',
};

const pipelineOptions: { value: ProspectPipelineStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Tous les statuts' },
  { value: 'NEW', label: 'Nouveau' },
  { value: 'IN_DISCUSSION', label: 'En discussion' },
  { value: 'OFFER_SENT', label: 'Devis envoyé' },
  { value: 'FOLLOW_UP', label: 'Relance' },
  { value: 'CLOSED', label: 'Fermé' },
];

const statusOptions: { value: ProspectStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Tous' },
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

function probabilityLabel(value: number | null | undefined) {
  if (value == null) return '—';
  return `${value}%`;
}

export default function BusinessProspectsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const router = useRouter();
  const activeCtx = useActiveBusiness({ optional: true });
  const role = activeCtx?.activeBusiness?.role ?? null;
  const isAdmin = role === 'ADMIN' || role === 'OWNER';
  const readOnlyMessage = 'Action réservée aux admins/owners.';

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [pipelineFilter, setPipelineFilter] = useState<ProspectPipelineStatus | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | 'ALL'>('ALL');
  const [probabilityMin, setProbabilityMin] = useState<string>('');
  const [nextActionBefore, setNextActionBefore] = useState<string>('');

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<ProspectForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [readOnlyInfo, setReadOnlyInfo] = useState<string | null>(null);

  const fetchController = useRef<AbortController | null>(null);

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
      setRequestId(null);

      const qs = new URLSearchParams();
      if (search.trim()) qs.set('q', search.trim());
      if (pipelineFilter !== 'ALL') qs.set('pipelineStatus', pipelineFilter);
      if (statusFilter !== 'ALL') qs.set('status', statusFilter);
      if (probabilityMin.trim()) qs.set('probabilityMin', probabilityMin.trim());
      if (nextActionBefore) qs.set('nextActionBefore', new Date(nextActionBefore).toISOString());

      const res = await fetchJson<ProspectListResponse>(
        `/api/pro/businesses/${businessId}/prospects${qs.toString() ? `?${qs.toString()}` : ''}`,
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
        const msg = res.error ?? 'Impossible de charger les prospects.';
        setError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
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
  }, [businessId, pipelineFilter, statusFilter]);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (!isAdmin) {
      setFormError(readOnlyMessage);
      setReadOnlyInfo(readOnlyMessage);
      setCreating(false);
      return;
    }
    setCreating(true);

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
    };
    if (!payload.name) {
      setFormError("Le nom du prospect est requis.");
      setCreating(false);
      return;
    }
    if (form.title.trim()) payload.title = form.title.trim();
    if (form.contactName.trim()) payload.contactName = form.contactName.trim();
    if (form.contactEmail.trim()) payload.contactEmail = form.contactEmail.trim();
    if (form.contactPhone.trim()) payload.contactPhone = form.contactPhone.trim();
    if (form.probability.trim()) payload.probability = Number(form.probability);
    if (form.nextActionDate) payload.nextActionDate = new Date(form.nextActionDate).toISOString();

    const res = await fetchJson<Prospect>(`/api/pro/businesses/${businessId}/prospects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setRequestId(res.requestId);

    if (!res.ok || !res.data) {
      const msg = res.error ?? 'Impossible de créer le prospect.';
      setFormError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      setCreating(false);
      return;
    }

    setCreateOpen(false);
    setForm(emptyForm);
    setCreating(false);
    await loadProspects();
  }

  return (
    <div className="space-y-5">
      <RoleBanner role={role} />
      <Card className="space-y-4 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
              Pro · Prospects
            </p>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">Pipeline prospects</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Un coup d’œil sur les leads et la prochaine action à mener.
            </p>
          </div>
          <div className="flex flex-col items-start gap-1">
            <Button
              onClick={() => {
                if (!isAdmin) {
                  setReadOnlyInfo(readOnlyMessage);
                  return;
                }
                setCreateOpen(true);
              }}
              disabled={!isAdmin}
            >
              Ajouter un prospect
            </Button>
            {!isAdmin ? (
              <p className="text-[11px] text-[var(--text-secondary)]">Lecture seule : création réservée aux admins.</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void loadProspects();
            }}
            className="flex flex-col gap-2 md:flex-row"
          >
            <Input
              placeholder="Rechercher (nom, contact)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button type="submit" variant="outline" className="whitespace-nowrap">
              Filtrer
            </Button>
          </form>
          <div className="grid gap-2 md:grid-cols-2">
            <Select
              label="Pipeline"
              value={pipelineFilter}
              onChange={(e) => setPipelineFilter(e.target.value as ProspectPipelineStatus | 'ALL')}
            >
              {pipelineOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Select
              label="Statut"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ProspectStatus | 'ALL')}
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <Input
              label="Proba min (%)"
              type="number"
              inputMode="numeric"
              value={probabilityMin}
              onChange={(e) => setProbabilityMin(e.target.value)}
              placeholder="40"
            />
            <Input
              label="Action avant le"
              type="date"
              value={nextActionBefore}
              onChange={(e) => setNextActionBefore(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Chargement des prospects…</p>
        ) : error ? (
          <p className="text-sm font-semibold text-rose-500">{error}</p>
        ) : prospects.length === 0 ? (
          <Card className="flex flex-col gap-3 border-dashed border-[var(--border)] bg-transparent p-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Crée ton premier prospect pour suivre ton pipeline.
            </p>
            <Button
              onClick={() => {
                if (!isAdmin) {
                  setReadOnlyInfo(readOnlyMessage);
                  return;
                }
                setCreateOpen(true);
              }}
              disabled={!isAdmin}
            >
              Ajouter un prospect
            </Button>
          </Card>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entreprise</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Proba</TableHead>
                  <TableHead>Prochaine action</TableHead>
                  <TableHead>Créé</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prospects.map((p) => (
                  <TableRow
                    key={p.id}
                    role="link"
                    tabIndex={0}
                    className="cursor-pointer transition hover:bg-[var(--surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                    onClick={() => router.push(`/app/pro/${businessId}/prospects/${p.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        router.push(`/app/pro/${businessId}/prospects/${p.id}`);
                      }
                    }}
                  >
                    <TableCell className="space-y-1">
                      <div className="font-semibold text-[var(--text-primary)]">{p.name}</div>
                      {p.title ? (
                        <div className="text-xs text-[var(--text-secondary)]">{p.title}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="space-y-1">
                      <div className="text-sm">{p.contactName ?? '—'}</div>
                      <div className="text-xs text-[var(--text-secondary)]">{p.contactEmail ?? p.contactPhone ?? ''}</div>
                    </TableCell>
                    <TableCell className="space-x-1">
                      <Badge variant="neutral">{p.pipelineStatus}</Badge>
                      <Badge variant="neutral">{p.status}</Badge>
                    </TableCell>
                    <TableCell>{probabilityLabel(p.probability)}</TableCell>
                    <TableCell>{formatDate(p.nextActionDate)}</TableCell>
                    <TableCell className="text-xs text-[var(--text-secondary)]">{formatDate(p.createdAt)}</TableCell>
                  </TableRow>
                ))}
                {prospects.length === 0 ? <TableEmpty>Aucun prospect.</TableEmpty> : null}
              </TableBody>
            </Table>
          </div>
        )}
        {requestId ? (
          <p className="text-[10px] text-[var(--text-faint)]">Req: {requestId}</p>
        ) : null}
        {readOnlyInfo ? <p className="text-xs text-[var(--text-secondary)]">{readOnlyInfo}</p> : null}
      </Card>

      <Modal
        open={createOpen}
        onCloseAction={() => {
          if (creating) return;
          setCreateOpen(false);
        }}
        title="Ajouter un prospect"
        description="Crée un nouveau contact dans le pipeline."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Nom de l’entreprise"
              required
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Acme"
            />
            <Input
              label="Titre / rôle"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="CMO / CTO…"
            />
            <Input
              label="Contact"
              value={form.contactName}
              onChange={(e) => setForm((prev) => ({ ...prev, contactName: e.target.value }))}
              placeholder="Nom du contact"
            />
            <Input
              label="Email"
              type="email"
              value={form.contactEmail}
              onChange={(e) => setForm((prev) => ({ ...prev, contactEmail: e.target.value }))}
              placeholder="contact@acme.test"
            />
            <Input
              label="Téléphone"
              value={form.contactPhone}
              onChange={(e) => setForm((prev) => ({ ...prev, contactPhone: e.target.value }))}
              placeholder="+33…"
            />
            <Input
              label="Probabilité (%)"
              type="number"
              inputMode="numeric"
              value={form.probability}
              onChange={(e) => setForm((prev) => ({ ...prev, probability: e.target.value }))}
              placeholder="50"
            />
            <Input
              label="Prochaine action"
              type="datetime-local"
              value={form.nextActionDate}
              onChange={(e) => setForm((prev) => ({ ...prev, nextActionDate: e.target.value }))}
            />
          </div>

          {formError ? <p className="text-sm font-semibold text-rose-500">{formError}</p> : null}
          {!isAdmin ? (
            <p className="text-xs text-[var(--text-secondary)]">Lecture seule : demande un rôle admin pour créer.</p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Annuler
            </Button>
            <Button type="submit" disabled={creating || !isAdmin}>
              {creating ? 'En cours…' : 'Ajouter le prospect'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
