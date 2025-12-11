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
        <span className="text-sm font-medium text-slate-300">{label}</span>
      ) : null}
      <input
        className={cn(
          'w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
          error ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400' : '',
          className
        )}
        {...props}
      />
      {error ? <span className="text-xs text-rose-400">{error}</span> : null}
    </label>
  );
}
