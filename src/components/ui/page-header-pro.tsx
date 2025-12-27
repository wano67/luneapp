import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type PageHeaderProProps = {
  title: string;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageHeaderPro({ title, description, meta, actions, className }: PageHeaderProProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)]/80 px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Projets</p>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">{title}</h1>
          {description ? <p className="text-sm text-[var(--text-secondary)]">{description}</p> : null}
          {meta ? <div className="text-xs text-[var(--text-secondary)]">{meta}</div> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap gap-2 sm:justify-end">{actions}</div> : null}
    </div>
  );
}
