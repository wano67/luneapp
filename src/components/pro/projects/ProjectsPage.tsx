"use client";

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { KpiCirclesBlock } from '@/components/pro/KpiCirclesBlock';
import { TabsPills } from '@/components/pro/TabsPills';
import { ProjectCard } from '@/components/pro/projects/ProjectCard';
import { useProjects } from '@/lib/hooks/useProjects';

type Props = { businessId: string };

function isActiveStatus(status: string | null | undefined) {
  if (!status) return false;
  const normalized = status.toUpperCase();
  return normalized === 'IN_PROGRESS' || normalized === 'ACTIVE' || normalized === 'ONGOING' || normalized === 'PLANNED';
}

export default function ProjectsPage({ businessId }: Props) {
  const { data, isLoading, error, refetch } = useProjects(businessId, {});
  const [view, setView] = useState<'active' | 'done'>('active');

  const kpis = useMemo(() => {
    const items = data ?? [];
    const total = items.length;
    const active = items.filter((p) => isActiveStatus(p.status) && !p.archivedAt).length;
    const late = items.filter((p) => {
      if (!p.endDate) return false;
      if (!isActiveStatus(p.status) || p.archivedAt) return false;
      return new Date(p.endDate) < new Date();
    }).length;
    return [
      { label: 'Projets', value: total },
      { label: 'En cours', value: active },
      { label: 'En retard', value: late },
    ];
  }, [data]);

  const filtered = useMemo(() => {
    const items = data ?? [];
    if (view === 'done') {
      return items.filter((p) => !isActiveStatus(p.status) || p.archivedAt);
    }
    return items.filter((p) => isActiveStatus(p.status) && !p.archivedAt);
  }, [data, view]);

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href={`/app/pro/${businessId}`} aria-label="Retour au dashboard">
              <ArrowLeft size={16} />
              Dashboard
            </Link>
          </Button>
          <Button asChild size="sm" className="gap-2">
            <Link href={`/app/pro/${businessId}/projects/new`} aria-label="Créer un projet">
              <Plus size={16} />
              Nouveau projet
            </Link>
          </Button>
        </div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Projets</h1>
        <p className="text-sm text-[var(--text-secondary)]">Vue synthétique des projets</p>
      </div>

      <KpiCirclesBlock items={kpis} />

      <TabsPills
        items={[
          { key: 'active', label: 'En cours' },
          { key: 'done', label: 'Terminés' },
        ]}
        value={view}
        onChange={(key) => setView(key as 'active' | 'done')}
        ariaLabel="Filtre projets"
        className="-mx-1 px-1"
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <Card
              key={key}
              className="min-h-[220px] animate-pulse rounded-3xl border border-[var(--border)] bg-[var(--surface)]"
            >
              <div className="h-full w-full rounded-2xl bg-[var(--surface-hover)]" />
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="flex items-center justify-between gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-rose-500">
          <span>{error}</span>
          <button
            type="button"
            onClick={refetch}
            className="rounded-md border border-[var(--border)] px-3 py-1 text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
          >
            Réessayer
          </button>
        </Card>
      ) : !filtered || filtered.length === 0 ? (
        <Card className="flex flex-col gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Aucun projet pour l’instant.</p>
          <div className="flex gap-2">
            <Link
              href={`/app/pro/${businessId}/projects/new`}
              className="cursor-pointer rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            >
              Créer un projet
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project) => (
            <ProjectCard key={project.id} businessId={businessId} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
