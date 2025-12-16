// src/app/app/pro/[businessId]/projects/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent, type ChangeEvent } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';

type ProjectStatus = 'PLANNED' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';

type Project = {
  id: string;
  businessId: string;
  clientId: string | null;
  clientName: string | null;
  name: string;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
};

type ProjectListResponse = {
  items: Project[];
};

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'PLANNED', label: 'Planifié' },
  { value: 'ACTIVE', label: 'En cours' },
  { value: 'ON_HOLD', label: 'Pause' },
  { value: 'COMPLETED', label: 'Terminé' },
  { value: 'CANCELLED', label: 'Annulé' },
];

function statusLabel(status: ProjectStatus) {
  return STATUS_OPTIONS.find((opt) => opt.value === status)?.label ?? status;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return value;
  }
}

export default function ProjectsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'ALL'>('ALL');

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('PLANNED');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchController = useRef<AbortController | null>(null);

  async function loadProjects(signal?: AbortSignal) {
    const controller = signal ? null : new AbortController();
    const effectiveSignal = signal ?? controller?.signal;
    if (controller) {
      fetchController.current?.abort();
      fetchController.current = controller;
    }

    try {
      setLoading(true);
      setError(null);
      const query = new URLSearchParams();
      if (statusFilter !== 'ALL') query.set('status', statusFilter);

      const res = await fetchJson<ProjectListResponse>(
        `/api/pro/businesses/${businessId}/projects${query.toString() ? `?${query.toString()}` : ''}`,
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
        setError(
          res.requestId
            ? `${res.error ?? 'Impossible de charger les projets.'} (Ref: ${res.requestId})`
            : res.error ?? 'Impossible de charger les projets.'
        );
        setProjects([]);
        return;
      }

      setProjects(res.data.items);
    } catch (err) {
      if (effectiveSignal?.aborted) return;
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      if (!effectiveSignal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    void loadProjects();
    return () => fetchController.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, statusFilter]);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setCreateError('Nom requis.');
      return;
    }

    try {
      setCreating(true);
      const res = await fetchJson<Project>(`/api/pro/businesses/${businessId}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          clientId: clientId.trim() || undefined,
          status,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
      });

      if (!res.ok || !res.data) {
        setCreateError(
          res.requestId ? `${res.error ?? 'Création impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Création impossible.'
        );
        return;
      }

      setName('');
      setClientId('');
      setStatus('PLANNED');
      setStartDate('');
      setEndDate('');
      setCreateOpen(false);
      await loadProjects();
    } catch (err) {
      console.error(err);
      setCreateError(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-3 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
              Projets
            </p>
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">Portefeuille projets</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Suis l’avancement et crée de nouveaux projets clients.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>Nouveau projet</Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {[{ value: 'ALL', label: 'Tous' }, ...STATUS_OPTIONS].map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={statusFilter === opt.value ? 'primary' : 'outline'}
              onClick={() => setStatusFilter(opt.value as ProjectStatus | 'ALL')}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Chargement des projets…</p>
        ) : error ? (
          <div className="space-y-2">
            <p className="text-sm text-rose-400">{error}</p>
            <Button size="sm" variant="outline" onClick={() => loadProjects()}>
              Réessayer
            </Button>
          </div>
        ) : projects.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">
              Aucun projet pour le moment. Crée ton premier projet.
            </p>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Créer un projet
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map((project) => (
              <div
                key={project.id}
                className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1">
                  <Link
                    href={`/app/pro/${businessId}/projects/${project.id}`}
                    className="font-semibold text-[var(--text-primary)] hover:underline"
                  >
                    {project.name}
                  </Link>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Client : {project.clientName ?? 'Non assigné'}
                  </p>
                  <p className="text-[10px] text-[var(--text-secondary)]">
                    {formatDate(project.startDate)} → {formatDate(project.endDate)}
                  </p>
                </div>
                <Badge variant="neutral">{statusLabel(project.status)}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={createOpen}
        onClose={() => (!creating ? setCreateOpen(false) : null)}
        title="Nouveau projet"
        description="Associe un client (optionnel) et fixe le statut."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Nom du projet *"
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            error={createError ?? undefined}
            placeholder="Site web, mission récurrente..."
          />

          <Input
            label="Client ID (optionnel)"
            value={clientId}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setClientId(e.target.value)}
            placeholder="Identifiant client"
          />

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-[var(--text-secondary)]">Statut</span>
              <select
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Début (optionnel)"
              type="date"
              value={startDate}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
            />
            <Input
              label="Fin (optionnel)"
              type="date"
              value={endDate}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setCreateOpen(false)} disabled={creating}>
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
