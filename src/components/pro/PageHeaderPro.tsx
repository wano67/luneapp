import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type PageHeaderProProps = {
  title: string;
  subtitle?: ReactNode;
  backHref?: string;
  backLabel?: string;
  leading?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/** @deprecated Use `PageHeader` from `@/components/layouts` instead. */
export function PageHeaderPro({
  title,
  subtitle,
  backHref,
  backLabel = 'Retour',
  leading,
  actions,
  className,
}: PageHeaderProProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
      data-component="page-header-pro"
    >
      <div className="min-w-0 space-y-2">
        {backHref ? (
          <Link
            href={backHref}
            className="text-xs text-[var(--text-secondary)] underline-offset-4 hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
          >
            ← {backLabel}
          </Link>
        ) : null}
        <div className="flex items-start gap-3">
          {leading ? <div className="shrink-0">{leading}</div> : null}
          <div className="min-w-0 space-y-1">
            <h1 className="truncate text-xl font-semibold text-[var(--text-primary)]">{title}</h1>
            {subtitle ? <div className="text-sm text-[var(--text-secondary)]">{subtitle}</div> : null}
          </div>
        </div>
      </div>
      {actions ? (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
