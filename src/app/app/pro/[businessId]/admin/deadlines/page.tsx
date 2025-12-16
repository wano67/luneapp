// src/app/app/pro/[businessId]/admin/deadlines/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AdminDeadlinesPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
          PRO · Admin · Deadlines
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Échéances</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Assure-toi de respecter les dates clés de Business #{businessId}.
        </p>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Échéances à venir</p>
          <Button size="sm" variant="outline" disabled>
            Ajouter (bientôt)
          </Button>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 p-4 text-sm text-[var(--text-secondary)]">
          Table deadlines à venir (API manquante).
        </div>
      </Card>
    </div>
  );
}
