import { cn } from '@/lib/cn';

type ProgressBarProps = {
  value: number;
  max?: number;
  color?: string;
  size?: 'sm' | 'md';
  className?: string;
};

export function ProgressBar({ value, max = 100, color, size = 'md', className }: ProgressBarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  return (
    <div className={cn('w-full rounded-full bg-[var(--surface-2)]', size === 'sm' ? 'h-1.5' : 'h-2.5', className)}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, background: color || 'var(--shell-accent)' }}
      />
    </div>
  );
}
