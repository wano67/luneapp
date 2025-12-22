// src/app/app/pro/ActiveBusinessBanner.tsx
'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useActiveBusiness } from './ActiveBusinessProvider';
import { FaviconAvatar } from '../components/FaviconAvatar';

export default function ActiveBusinessBanner() {
  const ctx = useActiveBusiness({ optional: true });
  if (!ctx || !ctx.activeBusiness) return null;

  const { activeBusiness, openSwitchModal } = ctx;

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <FaviconAvatar
          name={activeBusiness.name}
          websiteUrl={activeBusiness.websiteUrl}
          size={32}
        />
        <div className="flex flex-col">
          <p className="text-xs text-[var(--text-secondary)]">Entreprise active</p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {activeBusiness.name}
            </span>
            {activeBusiness.role ? <Badge variant="neutral">{activeBusiness.role}</Badge> : null}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={openSwitchModal}>
          Changer
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <Link href="/app/pro">Hub PRO</Link>
        </Button>
      </div>
    </div>
  );
}
