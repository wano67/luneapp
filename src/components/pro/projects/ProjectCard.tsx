import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatCurrencyEUR } from '@/lib/formatCurrency';
import type { ProjectListItem } from '@/lib/hooks/useProjects';

type Props = {
  businessId: string;
  project: ProjectListItem;
};

function projectStatusToCardStatus(project: ProjectListItem): 'active' | 'inactive' | 'neutral' {
  const status = project.status?.toUpperCase?.() ?? '';
  const activeStatuses = new Set(['IN_PROGRESS', 'ACTIVE', 'ONGOING', 'PLANNED']);
  const inactiveStatuses = new Set(['COMPLETED', 'DONE', 'ARCHIVED', 'CANCELLED']);
  if (project.archivedAt) return 'inactive';
  if (inactiveStatuses.has(status)) return 'inactive';
  if (activeStatuses.has(status)) return 'active';
  return 'neutral';
}

const STATUS_BORDER: Record<'active' | 'inactive' | 'neutral', string> = {
  active: 'border border-emerald-400/80',
  inactive: 'border border-rose-400/80',
  neutral: 'border border-[var(--border)]/60',
};

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value || 0));
  return (
    <div className="h-2 w-full rounded-full bg-[var(--surface-2)]">
      <div className="h-2 rounded-full bg-[var(--accent)] transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ProjectCard({ businessId, project }: Props) {
  const status = projectStatusToCardStatus(project);
  const progress = project.progress ?? project.tasksSummary?.progressPct ?? 0;
  const amountRaw = project.amountCents;
  const hasAmount = amountRaw !== undefined && amountRaw !== null;
  const amountCents =
    typeof amountRaw === 'number'
      ? amountRaw
      : typeof amountRaw === 'string'
        ? Number(amountRaw)
        : null;
  const value =
    hasAmount && typeof amountCents === 'number' && Number.isFinite(amountCents)
      ? formatCurrencyEUR(amountCents, { minimumFractionDigits: 0 })
      : '—';
  const progressPct = Math.min(100, Math.max(0, Number.isFinite(progress) ? Number(progress) : 0));

  return (
    <Link
      href={`/app/pro/${businessId}/projects/${project.id}`}
      className={cn(
        'group card-interactive relative block min-h-[220px] rounded-3xl bg-[var(--surface)] p-4 pb-14 text-left shadow-sm transition hover:-translate-y-[1px] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]',
        STATUS_BORDER[status],
      )}
    >
      <div className="flex h-full flex-col gap-4">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">Projet</p>
          <p className="line-clamp-2 text-base font-semibold leading-tight text-[var(--text-primary)]">
            {project.name || 'Sans nom'}
          </p>
          <p className="truncate text-[13px] text-[var(--text-secondary)]">
            {project.clientName ?? 'Sans client'}
          </p>
        </div>

        <div className="flex flex-col gap-2 text-[13px] text-[var(--text-secondary)]">
          <div className="flex items-center justify-between">
            <span>Valeur</span>
            <span className="text-[var(--text-primary)] font-medium">{value}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Avancement</span>
            <span className="text-[var(--text-primary)] font-medium">{progressPct.toFixed(0)}%</span>
          </div>
          <ProgressBar value={progressPct} />
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-5 right-5">
        <ArrowRight
          strokeWidth={2.75}
          className="text-[var(--text-secondary)] transition group-hover:translate-x-1 group-hover:text-[var(--text-primary)]"
        />
      </div>
    </Link>
  );
}
