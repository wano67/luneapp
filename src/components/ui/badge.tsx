import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type BadgeVariant = 'neutral' | 'pro' | 'personal' | 'performance';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  children: ReactNode;
};

const badgeVariants: Record<BadgeVariant, string> = {
  neutral: 'text-[var(--text-muted)] bg-[var(--surface-2)] border border-[var(--border)]',
  pro: 'text-[var(--accent-strong)] bg-[var(--surface-hover)] border border-[var(--accent-strong)]',
  personal:
    'text-[var(--success)] bg-[var(--success-bg)] border border-[var(--success-border)]',
  performance:
    'text-[var(--danger)] bg-[var(--danger-bg)] border border-[var(--danger-border)]',
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
        'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide',
        badgeVariants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
