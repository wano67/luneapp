import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Trend = 'up' | 'down' | 'neutral';

type KpiCardProps = {
  label: string;
  value: ReactNode;
  delta?: string | null;
  trend?: Trend;
  hint?: ReactNode;
  className?: string;
};

const trendColor: Record<Trend, string> = {
  up: 'text-[var(--success)]',
  down: 'text-[var(--danger)]',
  neutral: 'text-[var(--text-muted)]',
};

export function KpiCard({ label, value, delta, trend = 'neutral', hint, className }: KpiCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm',
        className
      )}
    >
      <div className="text-sm font-medium text-[var(--text-muted)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-[var(--text)]">{value}</div>
      <div className="mt-2 flex items-center gap-2 text-sm">
        {delta ? <span className={trendColor[trend]}>{delta}</span> : null}
        {hint ? <span className="text-[var(--text-secondary)]">{hint}</span> : null}
      </div>
    </div>
  );
}
