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
  /** Visual variant. 'primary' = accent pill (default), 'secondary' = subtle surface pill */
  variant?: 'primary' | 'secondary';
};

// Shared pill tabs with horizontal scroll on mobile and wrap on larger screens.
export function TabsPills({ items, value, onChange, ariaLabel, className, wrap = false, variant = 'primary' }: TabsPillsProps) {
  return (
    <div
      className={cn('w-full', className)}
      role="tablist"
      aria-label={ariaLabel ?? 'Navigation'}
      data-component="tabs-pills"
    >
      <div
        className={cn(
          'flex items-center gap-1',
          variant === 'secondary' && 'rounded-xl bg-[var(--surface-2)]/80 p-1',
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
                'cursor-pointer text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]',
                variant === 'primary'
                  ? cn(
                      'px-3 py-1.5',
                      active
                        ? 'rounded-xl bg-[var(--shell-accent-dark)] text-white'
                        : 'rounded-full text-[var(--text-faint)] hover:bg-[var(--surface-hover)]',
                    )
                  : cn(
                      'rounded-lg px-2.5 py-1',
                      active
                        ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-sm'
                        : 'text-[var(--text-faint)] hover:text-[var(--text-secondary)]',
                    ),
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
