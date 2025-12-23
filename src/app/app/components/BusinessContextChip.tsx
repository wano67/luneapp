'use client';

import { Badge } from '@/components/ui/badge';
import { FaviconAvatar } from './FaviconAvatar';

type Props = {
  businessName: string;
  websiteUrl?: string | null;
  roleLabel?: string | null;
};

export function BusinessContextChip({ businessName, websiteUrl, roleLabel }: Props) {
  return (
    <div className="inline-flex min-w-0 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
      <FaviconAvatar name={businessName} websiteUrl={websiteUrl} size={28} className="bg-[var(--surface)]" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[var(--text-primary)]" title={businessName}>
          {businessName}
        </p>
        {roleLabel ? (
          <Badge variant="neutral" className="mt-1 text-[11px] leading-tight">
            {roleLabel}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}
