import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Item = { label: string; value: ReactNode };

type Props = {
  items: Item[];
  className?: string;
};

// Premium KPI block used on Studio/Agenda: soft container + 3 identical circles
export function KpiCirclesBlock({ items, className }: Props) {
  const spanLastOnMobile = items.length === 3;

  return (
    <div className={cn('rounded-3xl bg-[var(--surface)]/70 p-4 sm:p-6', className)} data-component="kpi-circles">
      <div className="grid grid-cols-2 justify-items-center gap-3 sm:grid-cols-3 sm:gap-6">
        {items.map((item, idx) => (
          <div
            key={item.label}
            className={cn(
              'flex aspect-square w-full max-w-[104px] flex-col items-center justify-center rounded-full bg-[var(--surface)]/90 text-center shadow-[0_0_0_1px_var(--border)] sm:max-w-[136px]',
              spanLastOnMobile && idx === 2 ? 'col-span-2 justify-self-center sm:col-span-1 sm:justify-self-auto' : '',
            )}
          >
            <span className="text-lg font-bold leading-tight text-[var(--text-primary)] sm:text-2xl">{item.value}</span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)] sm:text-[11px]">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
