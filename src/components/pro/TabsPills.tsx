import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type TabItem = {
  key: string;
  label: ReactNode;
};

type TabsPillsProps = {
  items: ReadonlyArray<TabItem>;
  value: string;
  onChange: (key: string) => void;
  ariaLabel?: string;
  className?: string;
  /** When false, pills don't wrap and scroll horizontally instead (mobile-friendly). Default: false */
  wrap?: boolean;
};

// Shared pill tabs with horizontal scroll on mobile and wrap on larger screens.
export function TabsPills({ items, value, onChange, ariaLabel, className, wrap = false }: TabsPillsProps) {
  return (
    <div
      className={cn('w-full', className)}
      role="tablist"
      aria-label={ariaLabel ?? 'Navigation'}
      data-component="tabs-pills"
    >
      <div
        className={cn(
          'flex items-center gap-2',
          wrap ? 'flex-wrap' : 'scrollbar-thin flex-nowrap overflow-x-auto pb-1'
        )}
      >
        {items.map((tab) => {
          const active = tab.key === value;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.key)}
              className={cn(
                'cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]',
                active
                  ? 'border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]',
              )}
              data-active={active ? 'true' : 'false'}
            >
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
