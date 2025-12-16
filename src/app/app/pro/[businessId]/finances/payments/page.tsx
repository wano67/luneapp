// src/app/app/pro/[businessId]/finances/payments/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function PaymentsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  const kpis = [
    { label: 'Encaissements mois', value: '—' },
    { label: 'Impayés', value: '—' },
    { label: 'Délai moyen paiement', value: '—' },
    { label: 'Montant en retard', value: '—' },
  ];

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
          PRO · Finances · Payments
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Paiements</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Suis les encaissements et les retards pour Business #{businessId}.
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
          <p className="text-sm font-semibold text-[var(--text-primary)]">Paiements récents</p>
          <Button size="sm" variant="outline" disabled>
            Ajouter (bientôt)
          </Button>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 p-4 text-sm text-[var(--text-secondary)]">
          Table à venir (API payments manquante).
        </div>
      </Card>
    </div>
  );
}
