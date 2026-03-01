import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Item = { label: string; value: ReactNode };

type Props = {
  items: Item[];
  className?: string;
};

// Backward-compatible KPI block used across legacy pages.
// Rendering is card-based for better readability on small screens.
export function KpiCirclesBlock({ items, className }: Props) {
  return (
    <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3', className)} data-component="kpi-circles">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"
        >
          <p className="text-sm font-medium text-[var(--text-secondary)]">{item.label}</p>
          <div className="mt-2 break-words text-xl font-semibold leading-tight text-[var(--text-primary)] sm:text-2xl">
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
