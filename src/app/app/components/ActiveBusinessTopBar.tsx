'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FaviconAvatar } from './FaviconAvatar';

type Props = {
  businessName: string;
  websiteUrl?: string | null;
  roleLabel?: string | null;
  onChange?: () => void;
  hubHref?: string;
};

export function ActiveBusinessTopBar({ businessName, websiteUrl, roleLabel, onChange, hubHref = '/app/pro' }: Props) {
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 px-3 py-2">
      <FaviconAvatar name={businessName} websiteUrl={websiteUrl} size={32} className="bg-[var(--surface-2)]" />
      <div className="min-w-0">
        <p className="text-[11px] text-[var(--text-secondary)]">Entreprise active</p>
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-[var(--text-primary)]" title={businessName}>
            {businessName}
          </span>
          {roleLabel ? <Badge variant="neutral">{roleLabel}</Badge> : null}
        </div>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {onChange ? (
          <Button size="sm" variant="outline" onClick={onChange} className="whitespace-nowrap">
            Changer
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" asChild className="whitespace-nowrap">
          <Link href={hubHref}>Hub PRO</Link>
        </Button>
      </div>
    </div>
  );
}
