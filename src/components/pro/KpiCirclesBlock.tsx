import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Item = { label: string; value: ReactNode };

type Props = {
  items: Item[];
  className?: string;
};

// Premium KPI block used on Studio/Agenda: soft container + 3 identical circles
export function KpiCirclesBlock({ items, className }: Props) {
  return (
    <div className={cn('rounded-3xl bg-[var(--surface)]/70 p-5', className)}>
      <div className="grid grid-cols-1 justify-items-center gap-4 sm:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex h-[126px] w-[126px] flex-col items-center justify-center rounded-full bg-[var(--surface)]/90 text-center shadow-[0_0_0_1px_var(--border)] sm:h-[136px] sm:w-[136px]"
          >
            <span className="text-2xl font-bold text-[var(--text-primary)]">{item.value}</span>
            <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
