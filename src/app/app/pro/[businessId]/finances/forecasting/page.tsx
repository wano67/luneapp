// src/app/app/pro/[businessId]/finances/forecasting/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ForecastingPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  const kpis = [
    { label: 'Prévision CA', value: '—' },
    { label: 'Prévision charges', value: '—' },
    { label: 'Net prévisionnel', value: '—' },
    { label: 'Runway projeté', value: '—' },
  ];

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
          PRO · Finances · Forecasting
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Prévisions</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Scénarios et projections financières pour Business #{businessId}.
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
          <p className="text-sm font-semibold text-[var(--text-primary)]">Forecast</p>
          <Button size="sm" variant="outline" disabled>
            Ajouter un scénario (bientôt)
          </Button>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 p-4 text-sm text-[var(--text-secondary)]">
          Courbe prévisionnelle à venir (API forecast manquante).
        </div>
      </Card>
    </div>
  );
}
