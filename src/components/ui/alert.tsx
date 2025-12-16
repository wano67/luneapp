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
  info:
    'border-[var(--accent-strong)] bg-[color:rgba(37,99,235,0.12)] text-[var(--accent-strong)]',
  success:
    'border-[var(--success)] bg-[color:rgba(34,197,94,0.12)] text-[var(--success)]',
  danger:
    'border-[var(--danger)] bg-[color:rgba(239,68,68,0.12)] text-[var(--danger)]',
  warning:
    'border-[var(--warning)] bg-[color:rgba(245,158,11,0.14)] text-[var(--warning)]',
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
