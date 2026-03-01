"use client";

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/kpi-card';
import { ProPageShell } from '@/components/pro/ProPageShell';
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
    <ProPageShell
      backHref={`/app/pro/${businessId}`}
      backLabel="Dashboard"
      title="Projets"
      subtitle="Vue synthétique des projets"
      actions={
        <Button asChild size="sm" className="gap-2">
          <Link href={`/app/pro/${businessId}/projects/new`} aria-label="Créer un projet">
            <Plus size={16} />
            Nouveau projet
          </Link>
        </Button>
      }
      tabs={[
        { key: 'ACTIVE', label: 'Actifs' },
        { key: 'PLANNED', label: 'En attente' },
        { key: 'INACTIVE', label: 'Inactifs' },
      ]}
      activeTab={scope}
      onTabChange={(key) => setScope(key as ProjectScope)}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((item) => (
          <KpiCard key={item.label} label={item.label} value={item.value} />
        ))}
      </div>

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
          <Button type="button" variant="outline" size="sm" onClick={refetch}>
            Réessayer
          </Button>
        </Card>
      ) : !items || items.length === 0 ? (
        <Card className="flex flex-col gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{emptyLabel}</p>
          <div className="flex gap-2">
            <Button asChild size="sm">
              <Link href={`/app/pro/${businessId}/projects/new`}>Créer un projet</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((project) => (
            <ProjectCard key={project.id} businessId={businessId} project={project} onMutate={refetch} />
          ))}
        </div>
      )}
    </ProPageShell>
  );
}
