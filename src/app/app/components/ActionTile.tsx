// src/app/app/components/ActionTile.tsx
'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { useIsActivePath } from './useIsActivePath';

type ActionTileProps = {
  icon: ReactNode;
  title: string;
  description: string;
  href: string;
  activeHref?: string | string[];
  badge?: string;
  helper?: string;
};

export function ActionTile({
  icon,
  title,
  description,
  href,
  activeHref,
  badge,
  helper,
}: ActionTileProps) {
  const isActive = useIsActivePath(activeHref ?? href);

  return (
    <Link
      href={href}
      className="card-interactive group block"
      data-active={isActive || undefined}
      aria-label={`${title} - ${description}`}
    >
      <Card className="h-full rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 text-[var(--text-primary)]">
            <span className="card-interactive__icon rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-2 text-[var(--text-secondary)]">
              {icon}
            </span>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs text-[var(--text-secondary)]">{description}</p>
            </div>
          </div>
          <span className="text-[12px] text-[var(--text-secondary)]">→</span>
        </div>
        {badge ? <p className="mt-3 text-lg font-semibold text-[var(--text-primary)]">{badge}</p> : null}
        {helper ? <p className="text-xs text-[var(--text-secondary)]">{helper}</p> : null}
      </Card>
    </Link>
  );
}
