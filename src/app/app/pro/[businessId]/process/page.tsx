'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { useActiveBusiness } from '../../ActiveBusinessProvider';
import RoleBanner from '@/components/RoleBanner';

type ProcessStatus = 'ACTIVE' | 'ARCHIVED';

type Process = {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  status: ProcessStatus;
  stepsCount?: number;
  createdAt: string;
  updatedAt: string;
};

type ProcessListResponse = { items: Process[] };
type ProcessDetailResponse = { item: Process };

function formatDate(value: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return value;
  }
}

const STATUS_LABELS: Record<ProcessStatus, string> = {
  ACTIVE: 'Actif',
  ARCHIVED: 'Archivé',
};

export default function ProcessPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const activeCtx = useActiveBusiness({ optional: true });
  const actorRole = activeCtx?.activeBusiness?.role ?? null;
  const isAdmin = actorRole === 'OWNER' || actorRole === 'ADMIN';
  const readOnlyMessage = 'Action réservée aux admins/owners.';

  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [readOnlyInfo, setReadOnlyInfo] = useState<string | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });

  const fetchController = useRef<AbortController | null>(null);

  const activeProcesses = useMemo(
    () => processes.filter((p) => (includeArchived ? true : p.status === 'ACTIVE')),
    [processes, includeArchived]
  );

  function handleChange<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function loadProcesses(signal?: AbortSignal) {
    const controller = signal ? null : new AbortController();
    const effectiveSignal = signal ?? controller?.signal;
    if (controller) {
      fetchController.current?.abort();
      fetchController.current = controller;
    }

    try {
      setLoading(true);
      setError(null);
      setInfo(null);
      const query = includeArchived ? '?archived=1' : '';
      const res = await fetchJson<ProcessListResponse>(
        `/api/pro/businesses/${businessId}/processes${query}`,
        {},
        effectiveSignal
      );
      setRequestId(res.requestId);
      if (effectiveSignal?.aborted) return;
      if (!res.ok || !res.data) {
        setError(
          res.requestId
            ? `${res.error ?? 'Impossible de charger les process.'} (Ref: ${res.requestId})`
            : res.error ?? 'Impossible de charger les process.'
        );
        setProcesses([]);
        return;
      }
      setProcesses(res.data.items);
    } catch (err) {
      if (effectiveSignal?.aborted) return;
      setError(getErrorMessage(err));
    } finally {
      if (!effectiveSignal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    void loadProcesses();
    return () => fetchController.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, includeArchived]);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isAdmin) {
      setActionError(readOnlyMessage);
      setReadOnlyInfo(readOnlyMessage);
      return;
    }
    setCreating(true);
    setActionError(null);
    setInfo(null);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() ? form.description.trim() : undefined,
    };

    const res = await fetchJson<ProcessDetailResponse>(`/api/pro/businesses/${businessId}/processes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setRequestId(res.requestId);

    if (!res.ok || !res.data) {
      setActionError(
        res.requestId ? `${res.error ?? 'Création impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Création impossible.'
      );
      setCreating(false);
      return;
    }

    setInfo('Process créé.');
    setForm({ name: '', description: '' });
    setModalOpen(false);
    setCreating(false);
    await loadProcesses();
  }

  return (
    <div className="space-y-5">
      <RoleBanner role={actorRole} />
      <Card className="space-y-2 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
          Process & SOP
        </p>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">Processus opératoires</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Centralise les SOP et checklists par business. Archive les anciens, garde la trace.
            </p>
          </div>
          <div className="flex flex-col items-start gap-1">
            <Button
              onClick={() => {
                if (!isAdmin) {
                  setReadOnlyInfo(readOnlyMessage);
                  return;
                }
                setModalOpen(true);
              }}
              disabled={!isAdmin}
            >
              Nouveau process
            </Button>
            {!isAdmin ? (
              <p className="text-[11px] text-[var(--text-secondary)]">Lecture seule : création réservée aux admins.</p>
            ) : null}
          </div>
        </div>
        {requestId ? (
          <p className="text-[10px] text-[var(--text-secondary)]">Request ID: {requestId}</p>
        ) : null}
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setIncludeArchived((v) => !v)}>
              {includeArchived ? 'Afficher actifs' : 'Afficher archivés'}
            </Button>
            {info ? <span className="text-xs text-[var(--success)]">{info}</span> : null}
            {error ? <span className="text-xs text-[var(--danger)]">{error}</span> : null}
            {readOnlyInfo ? <span className="text-xs text-[var(--text-secondary)]">{readOnlyInfo}</span> : null}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Chargement des process…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Étapes</TableHead>
                <TableHead>Mise à jour</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeProcesses.length === 0 ? (
                <TableEmpty>Aucun process.</TableEmpty>
              ) : (
                activeProcesses.map((process) => (
                  <TableRow key={process.id}>
                    <TableCell className="font-semibold text-[var(--text-primary)]">
                      <Link href={`/app/pro/${businessId}/process/${process.id}`} className="hover:underline">
                        {process.name}
                      </Link>
                      {process.description ? (
                        <p className="text-[12px] text-[var(--text-secondary)] line-clamp-2">
                          {process.description}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="neutral"
                        className={
                          process.status === 'ACTIVE'
                            ? 'bg-[var(--success-bg)] text-[var(--success)]'
                            : 'bg-[var(--surface-2)] text-[var(--text)]'
                        }
                      >
                        {STATUS_LABELS[process.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{process.stepsCount ?? '—'}</TableCell>
                    <TableCell>{formatDate(process.updatedAt)}</TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/app/pro/${businessId}/process/${process.id}`}>Ouvrir</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onCloseAction={() => {
          if (creating) return;
          setModalOpen(false);
          setActionError(null);
          setForm({ name: '', description: '' });
        }}
        title="Nouveau process"
        description="Définis un nom clair et une description (optionnelle). Les étapes seront ajoutées ensuite."
      >
        <form onSubmit={handleCreate} className="space-y-3">
          <Input
            label="Nom"
            value={form.name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('name', e.target.value)}
            error={actionError ?? undefined}
            placeholder="Onboarding projet client"
          />
          <label className="space-y-1">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Description</span>
            <textarea
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              rows={3}
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Objectif, livrables, responsabilités…"
            />
          </label>
          <div className="flex items-center justify-between">
            {actionError ? <p className="text-xs text-[var(--danger)]">{actionError}</p> : null}
            {!isAdmin ? (
              <p className="text-[11px] text-[var(--text-secondary)]">Lecture seule : création bloquée.</p>
            ) : null}
            <div className="flex gap-2">
              <Button variant="outline" type="button" onClick={() => setModalOpen(false)} disabled={creating}>
                Annuler
              </Button>
              <Button type="submit" disabled={creating || !isAdmin}>
                {creating ? 'Création…' : 'Créer'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
