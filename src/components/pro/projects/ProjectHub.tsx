"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { KpiCirclesBlock } from '@/components/pro/KpiCirclesBlock';
import { TabsPills } from '@/components/pro/TabsPills';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { formatCurrencyEUR } from '@/lib/formatCurrency';
import { getProjectScopeLabelFR, getProjectScopeVariant, getProjectStatusLabelFR, isProjectOverdue } from '@/lib/projectStatusUi';
import { ProjectHealthBlock } from '@/components/pro/projects/overview/ProjectHealthBlock';
import {
  ServiceProgressList,
  type ProjectTaskLite,
  type ServiceItem,
} from '@/components/pro/projects/overview/ServiceProgressList';
import { TeamsBlock } from '@/components/pro/projects/overview/TeamsBlock';
import { ClientUpdatesBlock } from '@/components/pro/projects/overview/ClientUpdatesBlock';
import { RisksBlock } from '@/components/pro/projects/overview/RisksBlock';

type ProjectDetail = {
  id: string;
  name: string;
  clientName: string | null;
  clientId: string | null;
  status: string;
  archivedAt?: string | null;
  startDate: string | null;
  endDate: string | null;
  updatedAt: string;
  tasksSummary?: { total: number; open: number; done: number; progressPct: number };
  projectServices?: Array<{
    id: string;
    serviceId: string;
    priceCents: string | null;
    quantity: number;
    notes: string | null;
    service: { id: string; code: string; name: string; type: string | null };
  }>;
};

type Props = { businessId: string; projectId: string };

const tabs = [
  { key: 'overview', label: 'Vue d’ensemble' },
  { key: 'tasks', label: 'Tâches' },
  { key: 'billing', label: 'Facturation' },
  { key: 'payments', label: 'Paiements' },
  { key: 'files', label: 'Documents' },
  { key: 'activity', label: 'Activité' },
];

function formatDate(value: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return '—';
  }
}

export default function ProjectHub({ businessId, projectId }: Props) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [tasks, setTasks] = useState<ProjectTaskLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'billing' | 'payments' | 'files' | 'activity'>(
    'overview'
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetchJson<{ item: ProjectDetail }>(
          `/api/pro/businesses/${businessId}/projects/${projectId}`
        );
        if (!res.ok || !res.data) {
          if (!cancelled) setError(res.error ?? 'Projet introuvable');
          return;
        }
        if (!cancelled) setProject(res.data.item);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [businessId, projectId]);

  useEffect(() => {
    let cancelled = false;
    async function loadServices() {
      try {
        const res = await fetchJson<{ items: ServiceItem[] }>(
          `/api/pro/businesses/${businessId}/projects/${projectId}/services`
        );
        if (!cancelled && res.ok && res.data) {
          setServices(res.data.items);
        }
      } finally {
      }
    }
    void loadServices();
    return () => {
      cancelled = true;
    };
  }, [businessId, projectId]);

  useEffect(() => {
    let cancelled = false;
    async function loadTasks() {
      try {
        const res = await fetchJson<{ items: ProjectTaskLite[] }>(
          `/api/pro/businesses/${businessId}/tasks?projectId=${projectId}`
        );
        if (!cancelled && res.ok && res.data) {
          setTasks(res.data.items);
        }
      } finally {
      }
    }
    void loadTasks();
    return () => {
      cancelled = true;
    };
  }, [businessId, projectId]);

  const servicesTotalCents = useMemo(() => {
    if (!project?.projectServices) return 0;
    return project.projectServices.reduce((sum, s) => sum + Number(s.priceCents ?? 0), 0);
  }, [project]);

  const kpis = useMemo(() => {
    const progressValue = Math.min(100, Math.max(0, project?.tasksSummary?.progressPct ?? 0));
    const hasServices = Boolean(project?.projectServices && project.projectServices.length);
    const amountDisplay = hasServices
      ? formatCurrencyEUR(servicesTotalCents, { minimumFractionDigits: 0 })
      : '—';
    const due = project?.endDate
      ? formatDate(project.endDate)
      : project?.tasksSummary
        ? `${project.tasksSummary.open ?? 0}/${project.tasksSummary.total ?? 0} tâches`
        : '—';
    return [
      { label: 'Avancement', value: `${progressValue}%` },
      { label: 'Valeur', value: amountDisplay },
      { label: project?.endDate ? 'Échéance' : 'Tâches', value: due },
    ];
  }, [project, servicesTotalCents]);

  const health = useMemo(() => {
    const progress = project?.tasksSummary?.progressPct ?? 0;
    const endDateLabel = formatDate(project?.endDate ?? null);
    const isOverdue = isProjectOverdue(project?.endDate ?? null, project?.status ?? null, project?.archivedAt ?? null);
    const upcomingTask = tasks
      .filter((t) => t.status !== 'DONE')
      .sort((a, b) => (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) - (b.dueDate ? new Date(b.dueDate).getTime() : Infinity))[0];
    const nextActionLabel = upcomingTask ? `${upcomingTask.title} · ${formatDate(upcomingTask.dueDate)}` : '—';
    return { progress, endDateLabel, isOverdue, nextActionLabel };
  }, [project?.archivedAt, project?.endDate, project?.status, project?.tasksSummary?.progressPct, tasks]);

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href={`/app/pro/${businessId}/projects`} aria-label="Retour aux projets">
              <ArrowLeft size={16} />
              Retour
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/app/pro/${businessId}/projects/${projectId}/edit`}>Modifier</Link>
            </Button>
          </div>
        </div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{project?.name ?? `Projet #${projectId}`}</h1>
        <p className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
          <span>{project?.clientName ? `Client: ${project.clientName}` : 'Projet'}</span>
          <span aria-hidden>·</span>
          <span>Statut: {getProjectStatusLabelFR(project?.status ?? null)}</span>
          <Badge variant={getProjectScopeVariant(project?.status ?? null, project?.archivedAt ?? null)}>
            {getProjectScopeLabelFR(project?.status ?? null, project?.archivedAt ?? null)}
          </Badge>
          <span aria-hidden>·</span>
          <span>
            Dates: {formatDate(project?.startDate ?? null)} → {formatDate(project?.endDate ?? null)}
          </span>
        </p>
      </div>

      <KpiCirclesBlock items={kpis} />

      <TabsPills
        items={tabs}
        value={activeTab}
        onChange={(key) => setActiveTab(key as typeof activeTab)}
        ariaLabel="Onglets projet"
        className="-mx-1 px-1"
      />

      {loading ? (
        <EmptyState title="Chargement..." description="Nous récupérons les informations du projet." />
      ) : error ? (
        <EmptyState
          title="Impossible de charger le projet"
          description={error}
          action={
            <Button asChild>
              <Link href={`/app/pro/${businessId}/projects`}>Revenir à la liste</Link>
            </Button>
          }
        />
      ) : project ? (
        activeTab === 'overview' ? (
          <>
            <ProjectHealthBlock
              status={project.status ?? '—'}
              archivedAt={project.archivedAt ?? null}
              progressPct={health.progress}
              endDateLabel={health.endDateLabel}
              nextActionLabel={health.nextActionLabel}
              isOverdue={health.isOverdue}
            />

            <ServiceProgressList
              services={services}
              tasks={tasks}
              businessId={businessId}
              projectId={projectId}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <TeamsBlock businessId={businessId} />
              <ClientUpdatesBlock businessId={businessId} clientId={project.clientId} clientName={project.clientName} />
            </div>

            <RisksBlock
              businessId={businessId}
              overdueTasks={tasks.filter((t) => t.dueDate && t.status !== 'DONE' && new Date(t.dueDate) < new Date())}
            />
          </>
        ) : activeTab === 'tasks' ? (
          <EmptyState
            title="Tâches"
            description="Les tâches détaillées seront visibles ici."
            action={
              <Button asChild size="sm" variant="outline">
                <Link href={`/app/pro/${businessId}/tasks`}>Ouvrir les tâches</Link>
              </Button>
            }
          />
        ) : activeTab === 'billing' ? (
          <EmptyState title="Facturation" description="La facturation détaillée arrive prochainement." />
        ) : activeTab === 'payments' ? (
          <EmptyState title="Paiements" description="Les paiements associés seront affichés ici." />
        ) : activeTab === 'files' ? (
          <EmptyState title="Documents" description="Aucun document n’est encore disponible." />
        ) : (
          <EmptyState title="Activité" description="Aucune activité récente pour le moment." />
        )
      ) : (
        <EmptyState title="Projet introuvable" description="Ce projet n’existe plus ou a été archivé." />
      )}
    </div>
  );
}
