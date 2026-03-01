import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { BackButton } from './BackButton';

type PageHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  /** Optional leading element (avatar, icon, etc.) rendered before the title block */
  leading?: ReactNode;
  /** Actions slot — buttons, selects, etc. rendered opposite the title */
  actions?: ReactNode;
  /** Back navigation */
  backHref?: string;
  backLabel?: string;
  /** Extra content below the title row (context info, badges, etc.) */
  context?: ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  subtitle,
  leading,
  actions,
  backHref,
  backLabel,
  context,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {backHref ? <BackButton href={backHref} label={backLabel} /> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {leading ? <div className="shrink-0">{leading}</div> : null}
          <div className="min-w-0 space-y-1">
            <h1 className="truncate text-xl font-semibold text-[var(--text)]">{title}</h1>
            {subtitle ? (
              <div className="text-sm text-[var(--text-faint)]">{subtitle}</div>
            ) : null}
          </div>
        </div>

        {actions ? (
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
            {actions}
          </div>
        ) : null}
      </div>

      {context ? <div>{context}</div> : null}
    </div>
  );
}
