import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { TrendingUp, TrendingDown } from 'lucide-react';

type Trend = 'up' | 'down' | 'neutral';

type KpiCardProps = {
  label: string;
  value: ReactNode;
  delta?: string | null;
  trend?: Trend;
  hint?: ReactNode;
  loading?: boolean;
  /** Stagger animation delay in ms */
  delay?: number;
  /** "default" = 200px dashboard card ; "compact" = auto-height for marketing/inline */
  size?: 'default' | 'compact';
  className?: string;
};

export function KpiCard({ label, value, delta, trend = 'neutral', hint, loading, delay, size = 'default', className }: KpiCardProps) {
  const isCompact = size === 'compact';

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl bg-[var(--surface)] outline outline-[0.5px] outline-[var(--border)] animate-fade-in-up overflow-hidden',
        isCompact ? 'gap-2 p-4' : 'min-h-[160px] sm:min-h-[200px] justify-between p-3',
        className
      )}
      style={{
        animationDelay: delay ? `${delay}ms` : undefined,
        animationFillMode: delay ? 'backwards' : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-[var(--text)]">
          {label}
        </span>
        {delta ? (
          <div className="flex items-center gap-1 rounded-xl bg-[var(--shell-accent-dark)] px-3 py-1.5">
            <span
              className="text-white font-bold text-[14px] leading-[14px]"
              style={{ fontFamily: 'var(--font-roboto-mono), monospace' }}
            >
              {delta}
            </span>
            {trend === 'down' ? (
              <TrendingDown size={14} className="text-white" />
            ) : trend === 'up' ? (
              <TrendingUp size={14} className="text-white" />
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="min-w-0">
        {loading ? (
          <div className="h-10 w-32 rounded-lg bg-[var(--surface-2)] animate-skeleton-pulse" />
        ) : (
          <p
            className={cn(
              'font-extrabold text-[var(--shell-accent)] truncate',
              isCompact ? 'text-[20px] leading-[24px]' : 'text-[28px] leading-[28px] sm:text-[40px] sm:leading-[40px]'
            )}
          >
            {value}
          </p>
        )}
      </div>
      {hint && isCompact ? (
        <p className="text-xs text-[var(--text-faint)]">{hint}</p>
      ) : null}
    </div>
  );
}
