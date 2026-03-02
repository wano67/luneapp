import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type EmptyStateProps = {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
};

export function EmptyState({
  title,
  description,
  icon,
  action,
  children,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 px-6 py-12 text-center',
        className
      )}
    >
      {icon ? <div className="text-3xl" style={{ color: 'var(--text-faint)' }}>{icon}</div> : null}
      <div className="space-y-1">
        <p className="text-sm" style={{ color: 'var(--text-faint)' }}>{title}</p>
        {description ? (
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{description}</p>
        ) : null}
      </div>
      {children}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
