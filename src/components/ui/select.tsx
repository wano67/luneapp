'use client';

import type { ReactNode, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string | ReactNode;
  error?: string | null;
};

export function Select({ label, error, className, children, ...props }: SelectProps) {
  return (
    <label className="flex w-full flex-col gap-1">
      {label ? (
        <span className="text-sm font-medium text-[var(--text-secondary)]">{label}</span>
      ) : null}
      <div className="relative">
        <select
          className={cn(
            'w-full appearance-none rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 pr-12 text-base text-[var(--text-primary)] transition-colors',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]',
            error
              ? 'border-[var(--danger)] focus-visible:outline-[var(--danger)]'
              : 'hover:border-[var(--border-strong)]',
            className
          )}
          {...props}
        >
          {children}
        </select>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[var(--text-secondary)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
      {error ? <span className="text-xs text-[var(--danger)]">{error}</span> : null}
    </label>
  );
}

export default Select;
