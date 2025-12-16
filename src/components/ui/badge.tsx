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
    'text-emerald-700 dark:text-emerald-300 bg-[color:rgba(16,185,129,0.12)] border border-emerald-500/60',
  performance:
    'text-rose-700 dark:text-rose-300 bg-[color:rgba(244,63,94,0.12)] border border-rose-500/60',
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
