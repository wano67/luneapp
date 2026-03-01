import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type AlertVariant = 'neutral' | 'info' | 'success' | 'danger' | 'warning';

type AlertProps = {
  title?: string;
  description?: ReactNode;
  children?: ReactNode;
  variant?: AlertVariant;
  className?: string;
  actions?: ReactNode;
};

const variantClasses: Record<AlertVariant, string> = {
  neutral: 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]',
  info: 'border-[var(--info-border)] bg-[var(--info-bg)] text-[var(--info)]',
  success: 'border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success)]',
  danger: 'border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)]',
  warning: 'border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning)]',
};

export function Alert({
  title,
  description,
  children,
  variant = 'neutral',
  className,
  actions,
}: AlertProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-2xl border px-4 py-3 text-sm',
        variantClasses[variant],
        className
      )}
      role="status"
    >
      {title ? <div className="text-sm font-semibold">{title}</div> : null}
      {description ? (
        <div className="text-sm leading-relaxed text-current opacity-90">{description}</div>
      ) : null}
      {children}
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
