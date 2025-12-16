// src/app/app/pro/[businessId]/references/automations/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AutomationsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
          PRO · References · Automations
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Automations</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Règles et SOP automatisées pour Business #{businessId}.
        </p>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Règles</p>
          <Button size="sm" variant="outline" disabled>
            Nouvelle règle (bientôt)
          </Button>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 p-4 text-sm text-[var(--text-secondary)]">
          Table automations à venir (API manquante).
        </div>
      </Card>
    </div>
  );
}
