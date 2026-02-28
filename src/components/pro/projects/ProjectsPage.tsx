"use client";

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { KpiCirclesBlock } from '@/components/pro/KpiCirclesBlock';
import { TabsPills } from '@/components/pro/TabsPills';
import { ProjectCard } from '@/components/pro/projects/ProjectCard';
import { useProjects, type ProjectScope } from '@/lib/hooks/useProjects';

type Props = { businessId: string };

export default function ProjectsPage({ businessId }: Props) {
  const [scope, setScope] = useState<ProjectScope>('ACTIVE');
  const { data, counts, isLoading, error, refetch } = useProjects(businessId, { scope });

  const kpis = useMemo(() => {
    const snapshot = counts ?? { active: 0, planned: 0, inactive: 0 };
    const taskSnapshot = counts?.activeTasks ?? { total: 0, done: 0 };
    return [
      { label: 'Actifs', value: snapshot.active },
      { label: 'En attente', value: snapshot.planned },
      { label: 'Tâches (projets en cours)', value: `${taskSnapshot.done} / ${taskSnapshot.total}` },
    ];
  }, [counts]);

  const items = data ?? [];
  const emptyLabel =
    scope === 'ACTIVE'
      ? 'Aucun projet actif pour l’instant.'
      : scope === 'PLANNED'
        ? 'Aucun projet en attente pour l’instant.'
        : 'Aucun projet inactif pour l’instant.';

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
          { key: 'ACTIVE', label: 'Actifs' },
          { key: 'PLANNED', label: 'En attente' },
          { key: 'INACTIVE', label: 'Inactifs' },
        ]}
        value={scope}
        onChange={(key) => setScope(key as ProjectScope)}
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
        <Card className="flex items-center justify-between gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--danger)]">
          <span>{error}</span>
          <button
            type="button"
            onClick={refetch}
            className="rounded-md border border-[var(--border)] px-3 py-1 text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
          >
            Réessayer
          </button>
        </Card>
      ) : !items || items.length === 0 ? (
        <Card className="flex flex-col gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{emptyLabel}</p>
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
          {items.map((project) => (
            <ProjectCard key={project.id} businessId={businessId} project={project} onMutate={refetch} />
          ))}
        </div>
      )}
    </div>
  );
}
