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
        'flex flex-col rounded-xl animate-fade-in-up',
        isCompact ? 'gap-2' : 'justify-between',
        className
      )}
      style={{
        minHeight: isCompact ? undefined : 200,
        padding: isCompact ? '16px' : 12,
        background: 'var(--surface)',
        outline: '0.5px solid var(--border)',
        animationDelay: delay ? `${delay}ms` : undefined,
        animationFillMode: delay ? 'backwards' : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          {label}
        </span>
        {delta ? (
          <div
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl"
            style={{ background: 'var(--shell-accent-dark)' }}
          >
            <span
              className="text-white font-bold"
              style={{
                fontFamily: 'var(--font-roboto-mono), monospace',
                fontSize: 14,
                lineHeight: '14px',
              }}
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
      <div>
        {loading ? (
          <div
            className="h-10 w-32 rounded-lg animate-skeleton-pulse"
            style={{ background: 'var(--surface-2)' }}
          />
        ) : (
          <span
            style={{
              color: 'var(--shell-accent)',
              fontSize: isCompact ? 20 : 40,
              fontWeight: 800,
              lineHeight: isCompact ? '24px' : '40px',
            }}
          >
            {value}
          </span>
        )}
      </div>
      {hint && isCompact ? (
        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{hint}</p>
      ) : null}
    </div>
  );
}
