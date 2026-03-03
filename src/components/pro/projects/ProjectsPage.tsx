"use client";

import { useState } from 'react';
import Link from 'next/link';
import { FolderOpen, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/kpi-card';
import { ProPageShell } from '@/components/pro/ProPageShell';
import { ProjectCard } from '@/components/pro/projects/ProjectCard';
import { useProjects, type ProjectScope } from '@/lib/hooks/useProjects';

const SCOPES = [
  { key: 'ACTIVE' as const, label: 'Actifs' },
  { key: 'PLANNED' as const, label: 'En attente' },
  { key: 'INACTIVE' as const, label: 'Terminé' },
] as const;

type Props = { businessId: string };

export default function ProjectsPage({ businessId }: Props) {
  const [scope, setScope] = useState<ProjectScope>('ACTIVE');
  const [search, setSearch] = useState('');
  const { data, counts, isLoading, error, refetch } = useProjects(businessId, {
    scope,
    q: search || undefined,
  });

  const taskSnapshot = counts?.activeTasks ?? { total: 0, done: 0 };
  const taskPct =
    taskSnapshot.total > 0
      ? Math.round((taskSnapshot.done / taskSnapshot.total) * 100)
      : 0;

  const items = data ?? [];
  const emptyLabel =
    scope === 'ACTIVE'
      ? 'Aucun projet actif pour l\u2019instant.'
      : scope === 'PLANNED'
        ? 'Aucun projet en attente pour l\u2019instant.'
        : 'Aucun projet terminé pour l\u2019instant.';

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
    >
      {/* KPI cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <KpiCard label="Actifs" value={counts?.active ?? 0} loading={isLoading} delay={0} />
        <KpiCard label="En attente" value={counts?.planned ?? 0} loading={isLoading} delay={50} />
        {/* Tasks KPI with progress bar */}
        <div
          className="flex min-h-[200px] flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 animate-fade-in-up"
          style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}
        >
          <span className="text-sm font-medium text-[var(--text)]">
            Tâches (projets en cours)
          </span>
          <div className="flex flex-col gap-2">
            {isLoading ? (
              <div className="h-10 w-32 rounded-lg bg-[var(--surface-2)] animate-skeleton-pulse" />
            ) : (
              <>
                <span className="text-[40px] font-extrabold leading-[40px] text-[var(--shell-accent)]">
                  {taskSnapshot.done} / {taskSnapshot.total}
                </span>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-[var(--text-faint)]">
                    {taskPct}% complété
                  </span>
                  <div className="h-2 w-full rounded-full bg-[var(--surface-2)]">
                    <div
                      className="h-2 rounded-full bg-[var(--shell-accent)] transition-all"
                      style={{ width: `${taskPct}%` }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Section header: Projet label + search + filter pills */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FolderOpen size={18} style={{ color: 'var(--text-secondary)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Projet</span>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 rounded-full overflow-hidden"
            style={{ background: 'var(--surface-2)', padding: '6px 12px' }}
          >
            <Search size={14} style={{ color: 'var(--text-faint)' }} />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-sm outline-none placeholder:text-[var(--text-faint)]"
              style={{ color: 'var(--text)', width: 160 }}
            />
          </div>
          <div className="flex items-center gap-1.5">
            {SCOPES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setScope(s.key)}
                className="cursor-pointer rounded-xl px-3 py-1.5 text-sm font-medium transition"
                style={{
                  background: scope === s.key ? 'var(--shell-accent-dark)' : 'var(--surface)',
                  color: scope === s.key ? 'white' : 'rgba(0,0,0,0.6)',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Project cards grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((key) => (
            <div
              key={key}
              className="rounded-xl animate-skeleton-pulse"
              style={{ height: 200, background: 'var(--surface-2)' }}
            />
          ))}
        </div>
      ) : error ? (
        <Card className="flex items-center justify-between gap-3 p-4 text-sm text-[var(--danger)]">
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" onClick={refetch}>
            Réessayer
          </Button>
        </Card>
      ) : items.length === 0 ? (
        <Card className="flex flex-col gap-3 p-5">
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{emptyLabel}</p>
          <div className="flex gap-2">
            <Button asChild size="sm">
              <Link href={`/app/pro/${businessId}/projects/new`}>Créer un projet</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((project, i) => (
            <ProjectCard key={project.id} businessId={businessId} project={project} onMutate={refetch} index={i} />
          ))}
        </div>
      )}
    </ProPageShell>
  );
}
