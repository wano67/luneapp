// src/app/app/pro/[businessId]/finances/treasury/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function TreasuryPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  const kpis = [
    { label: 'Solde trésorerie', value: '—' },
    { label: 'Cashflow mensuel', value: '—' },
    { label: 'Runway estimé', value: '—' },
    { label: 'Prévision 3 mois', value: '—' },
  ];

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
          PRO · Finances · Treasury
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Trésorerie</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Suivi cash et projections pour Business #{businessId}.
        </p>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="p-4">
            <p className="text-xs text-[var(--text-secondary)]">{kpi.label}</p>
            <p className="text-lg font-semibold text-[var(--text-primary)]">{kpi.value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Flux de trésorerie</p>
          <Button size="sm" variant="outline" disabled>
            Export (bientôt)
          </Button>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 p-4 text-sm text-[var(--text-secondary)]">
          Vue cashflow à venir (API trésorerie manquante).
        </div>
      </Card>
    </div>
  );
}
