import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GuidedCtaCard } from '@/components/pro/shared/GuidedCtaCard';

export type ServiceItem = {
  id: string;
  service: { name: string; type?: string | null; code?: string | null };
  priceCents?: string | number | null;
  quantity?: number | null;
};

export type ProjectTaskLite = {
  id: string;
  title: string;
  status: string;
  progress: number;
  dueDate: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  projectServiceId: string | null;
};

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="h-1.5 w-full rounded-full bg-[var(--surface-2)]">
      <div className="h-1.5 rounded-full bg-[var(--accent)] transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function formatTaskStatus(status: string) {
  if (!status) return '—';
  if (status === 'DONE') return 'Terminée';
  if (status === 'IN_PROGRESS') return 'En cours';
  if (status === 'TODO') return 'À faire';
  return status;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return '—';
  }
}

export function ServiceProgressList({
  services,
  tasks,
  businessId,
  projectId,
}: {
  services: ServiceItem[];
  tasks: ProjectTaskLite[];
  businessId: string;
  projectId: string;
}) {
  if (!services.length) {
    return (
      <GuidedCtaCard
        title="Aucun service ajouté au projet."
        description="Les services structurent le projet et déclenchent les tâches."
        primary={{ label: 'Ajouter des services', href: `/app/pro/${businessId}/services` }}
        secondary={{ label: 'Importer depuis le catalogue', href: `/app/pro/${businessId}/services` }}
      />
    );
  }

  return (
    <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--text-primary)]">Services & avancement</p>
        <Button asChild size="sm" variant="outline">
          <Link href={`/app/pro/${businessId}/tasks?projectId=${projectId}`}>Voir les tâches</Link>
        </Button>
      </div>
      <div className="space-y-3">
        {services.map((service) => {
          const relatedTasks = tasks.filter((t) => t.projectServiceId === service.id);
          const total = relatedTasks.length;
          const done = relatedTasks.filter((t) => t.status === 'DONE').length;
          const progress =
            total > 0 ? Math.round((relatedTasks.reduce((acc, t) => acc + (t.status === 'DONE' ? 100 : t.progress || 0), 0)) / total) : 0;
          const topTasks = relatedTasks.slice(0, 3);
          return (
            <div
              key={service.id}
              className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface)]/80 p-3 shadow-[0_0_0_1px_var(--border)]/50"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{service.service.name}</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {done}/{total || '—'} tâches · {progress}%</p>
                </div>
                <Button asChild size="sm" variant="ghost" className="text-xs">
                  <Link href={`/app/pro/${businessId}/tasks?projectId=${projectId}`}>Voir les tâches</Link>
                </Button>
              </div>
              <div className="mt-2">
                <ProgressBar value={progress} />
              </div>
              <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                {topTasks.length ? (
                  topTasks.map((task) => (
                    <div key={task.id} className="flex items-start justify-between gap-2 rounded-lg border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-[var(--text-primary)]">{task.title}</p>
                        <p className="text-[11px]">
                          {formatTaskStatus(task.status)} · {task.assigneeName || task.assigneeEmail || 'Non assigné'}
                        </p>
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)]">{formatDate(task.dueDate)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[var(--text-secondary)]">Aucune tâche associée pour l’instant.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
