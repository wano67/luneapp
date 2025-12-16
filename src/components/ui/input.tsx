import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string | ReactNode;
  error?: string | null;
};

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <label className="flex w-full flex-col gap-1">
      {label ? (
        <span className="text-sm font-medium text-[var(--text-secondary)]">{label}</span>
      ) : null}
      <input
        className={cn(
          'w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400/60',
          error ? 'border-rose-400 focus-visible:outline-rose-400/70' : '',
          className
        )}
        {...props}
      />
      {error ? <span className="text-xs text-rose-400">{error}</span> : null}
    </label>
  );
}
