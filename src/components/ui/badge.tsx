import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type BadgeVariant = 'neutral' | 'pro' | 'personal' | 'performance' | 'success' | 'danger' | 'warning' | 'info';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  children: ReactNode;
};

const badgeVariants: Record<BadgeVariant, string> = {
  neutral: 'text-[var(--text-muted)] bg-[var(--surface-2)] border border-[var(--border)]',
  pro: 'text-white bg-[var(--shell-accent-dark)] border border-[var(--shell-accent-dark)]',
  personal:
    'text-[var(--success)] bg-[var(--success-bg)] border border-[var(--success-border)]',
  performance:
    'text-[var(--danger)] bg-[var(--danger-bg)] border border-[var(--danger-border)]',
  success: 'text-[var(--success)] bg-[var(--success-bg)] border border-[var(--success-border)]',
  danger: 'text-[var(--danger)] bg-[var(--danger-bg)] border border-[var(--danger-border)]',
  warning: 'text-[var(--warning)] bg-[var(--warning-bg)] border border-[var(--warning-border)]',
  info: 'text-[var(--info)] bg-[var(--info-bg)] border border-[var(--info-border)]',
};

export function Badge({
  children,
  className,
  variant = 'neutral',
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-xl px-3 py-1 text-xs font-semibold uppercase tracking-wide',
        badgeVariants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
