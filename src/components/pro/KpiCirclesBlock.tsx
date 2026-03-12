import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Item = { label: string; value: ReactNode };

type Props = {
  items: Item[];
  className?: string;
};

// Compact inline KPI row used on client/prospect pages.
export function KpiCirclesBlock({ items, className }: Props) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)} data-component="kpi-circles">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
        >
          <span className="text-xs text-[var(--text-secondary)]">{item.label}</span>
          <span className="text-sm font-semibold text-[var(--text-primary)]">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
