// src/app/app/pro/[businessId]/projects/[projectId]/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchJson } from '@/lib/apiClient';

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

type ProjectDetailResponse = {
  item: Project;
};

function statusLabel(status: ProjectStatus) {
  switch (status) {
    case 'PLANNED':
      return 'Planifié';
    case 'ACTIVE':
      return 'En cours';
    case 'ON_HOLD':
      return 'Pause';
    case 'COMPLETED':
      return 'Terminé';
    case 'CANCELLED':
      return 'Annulé';
    default:
      return status;
  }
}

function formatDate(value: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return value;
  }
}

export default function ProjectDetailPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const projectId = (params?.projectId ?? '') as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchController = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchController.current?.abort();
    fetchController.current = controller;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetchJson<ProjectDetailResponse>(
          `/api/pro/businesses/${businessId}/projects/${projectId}`,
          {},
          controller.signal
        );

        if (controller.signal.aborted) return;

        if (res.status === 401) {
          const from = window.location.pathname + window.location.search;
          window.location.href = `/login?from=${encodeURIComponent(from)}`;
          return;
        }

        if (!res.ok || !res.data) {
          const msg = res.error ?? 'Chargement impossible.';
          setError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
          setProject(null);
          return;
        }

        setProject(res.data.item);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error(err);
        setError('Impossible de charger ce projet.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [businessId, projectId]);

  if (loading) {
    return (
      <Card className="p-5">
        <p className="text-sm text-[var(--text-secondary)]">Chargement du projet…</p>
      </Card>
    );
  }

  if (!project) {
    return (
      <Card className="space-y-2 p-5">
        <p className="text-sm font-semibold text-rose-400">{error ?? 'Projet introuvable.'}</p>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/app/pro/${businessId}/projects`}>Retour à la liste</Link>
        </Button>
        <p className="text-[10px] text-[var(--text-secondary)]">
          TODO: GET/PATCH /api/pro/businesses/{businessId}/projects/{projectId} pour charger/éditer directement.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-3 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
              Projet · Centre de pilotage
            </p>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">{project.name}</h1>
            <p className="text-xs text-[var(--text-secondary)]">
              Cockpit projet — charges et finances à venir.
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              Client : {project.clientName ?? 'Non assigné'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">{statusLabel(project.status)}</Badge>
            <Badge variant="neutral">ID {project.id}</Badge>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Début</p>
            <p className="text-sm text-[var(--text-primary)]">{formatDate(project.startDate)}</p>
          </Card>
          <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Échéance</p>
            <p className="text-sm text-[var(--text-primary)]">{formatDate(project.endDate)}</p>
          </Card>
          <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Avancement (stub)</p>
            <p className="text-sm text-[var(--text-secondary)]">TODO: pourcentage + jalons.</p>
          </Card>
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Planning / phases — stub</p>
          <Badge variant="neutral">À venir</Badge>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          TODO: endpoints pour phases/timeline du projet.
        </p>
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Tâches — stub</p>
          <Badge variant="neutral">À venir</Badge>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          TODO: tasks API (CRUD) pour lier tâches au projet.
        </p>
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Finance projet — stub</p>
          <Badge variant="neutral">À venir</Badge>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          TODO: factures, dépenses, marge projet (APIs finances).
        </p>
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Qualité / process — stub</p>
          <Badge variant="neutral">À venir</Badge>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          TODO: checklists qualité, risques, RACI.
        </p>
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Relation client — stub</p>
          <Badge variant="neutral">À venir</Badge>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          TODO: feedbacks, CSAT/NPS, réunions prévues.
        </p>
      </Card>
    </div>
  );
}
