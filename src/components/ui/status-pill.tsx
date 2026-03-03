import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type StatusPillVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

type StatusPillProps = {
  variant: StatusPillVariant;
  children: ReactNode;
  className?: string;
};

const variantStyles: Record<StatusPillVariant, string> = {
  success: 'bg-[var(--success-bg)] text-[var(--success)] border-[var(--success-border)]',
  warning: 'bg-[var(--warning-bg)] text-[var(--warning)] border-[var(--warning-border)]',
  danger: 'bg-[var(--danger-bg)] text-[var(--danger)] border-[var(--danger-border)]',
  neutral: 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)]',
  info: 'bg-[var(--info-bg)] text-[var(--info)] border-[var(--info-border)]',
};

export function StatusPill({ variant, children, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
