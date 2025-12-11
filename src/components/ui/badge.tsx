import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type BadgeVariant = 'neutral' | 'pro' | 'personal' | 'performance';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  children: ReactNode;
};

const badgeVariants: Record<BadgeVariant, string> = {
  neutral: 'text-slate-300 bg-slate-800/80 border border-slate-700',
  pro: 'text-blue-300 bg-blue-500/10 border border-blue-500/40',
  personal: 'text-emerald-300 bg-emerald-500/10 border border-emerald-500/40',
  performance: 'text-rose-300 bg-rose-500/10 border border-rose-500/40',
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
