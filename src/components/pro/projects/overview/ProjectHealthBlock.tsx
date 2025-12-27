import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

type Props = {
  status: string | null;
  progressPct: number;
  endDateLabel: string;
  nextActionLabel: string;
  isOverdue: boolean;
};

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="h-2 w-full rounded-full bg-[var(--surface-2)]">
      <div className="h-2 rounded-full bg-[var(--accent)] transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ProjectHealthBlock({ status, progressPct, endDateLabel, nextActionLabel, isOverdue }: Props) {
  return (
    <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--text-primary)]">Santé du projet</p>
        {isOverdue ? <Badge variant="performance">En retard</Badge> : null}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1 text-sm text-[var(--text-secondary)]">
          <p>Statut</p>
          <Badge variant="neutral">{status || '—'}</Badge>
        </div>
        <div className="space-y-2 text-sm text-[var(--text-secondary)]">
          <div className="flex items-center justify-between text-[var(--text-primary)]">
            <span>Avancement global</span>
            <span className="font-semibold">{progressPct.toFixed(0)}%</span>
          </div>
          <ProgressBar value={progressPct} />
        </div>
        <div className="space-y-1 text-sm text-[var(--text-secondary)]">
          <p>Échéance</p>
          <p className="text-[var(--text-primary)] font-medium">{endDateLabel}</p>
        </div>
        <div className="space-y-1 text-sm text-[var(--text-secondary)]">
          <p>Prochaine action</p>
          <p className="text-[var(--text-primary)] font-medium">{nextActionLabel || '—'}</p>
        </div>
      </div>
    </Card>
  );
}
