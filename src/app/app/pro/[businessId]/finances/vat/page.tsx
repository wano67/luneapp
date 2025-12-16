// src/app/app/pro/[businessId]/finances/vat/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function VatPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  const kpis = [
    { label: 'TVA collectée', value: '—' },
    { label: 'TVA déductible', value: '—' },
    { label: 'TVA due (période)', value: '—' },
    { label: 'Prochaine échéance', value: '—' },
  ];

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
          PRO · Finances · VAT
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">TVA</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Suivi TVA pour Business #{businessId}.
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
          <p className="text-sm font-semibold text-[var(--text-primary)]">Déclarations</p>
          <Button size="sm" variant="outline" disabled>
            Export (bientôt)
          </Button>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 p-4 text-sm text-[var(--text-secondary)]">
          Tableau TVA à venir (API manquante).
        </div>
      </Card>
    </div>
  );
}
