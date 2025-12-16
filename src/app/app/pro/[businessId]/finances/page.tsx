// src/app/app/pro/[businessId]/finances/page.tsx
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function FinancesStubPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  return (
    <div className="space-y-4">
      <Card className="space-y-2 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
          Finances — stub
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">
          Finances de l’entreprise
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Revenus, factures, dépenses, trésorerie et rentabilité.
        </p>
        {/* TODO: API finances (factures, dépenses) */}
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="space-y-2 border-dashed border-[var(--border)] bg-transparent p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Factures</p>
            <Badge variant="neutral">À venir</Badge>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Liste des factures clients, statut paiement, échéances.
          </p>
          <Link
            href={`/app/pro/${businessId}/finances/invoices/001`}
            className="text-sm font-semibold text-[var(--accent)] underline"
          >
            Voir une facture type →
          </Link>
          {/* TODO: GET/POST /api/pro/businesses/{businessId}/finances/invoices */}
        </Card>

        <Card className="space-y-2 border-dashed border-[var(--border)] bg-transparent p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Dépenses</p>
            <Badge variant="neutral">À venir</Badge>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Charges, fournisseurs, reçus et catégorisation.
          </p>
          <Link
            href={`/app/pro/${businessId}/finances/expenses/001`}
            className="text-sm font-semibold text-[var(--accent)] underline"
          >
            Voir une dépense type →
          </Link>
          {/* TODO: GET/POST /api/pro/businesses/{businessId}/finances/expenses */}
        </Card>
      </div>
    </div>
  );
}
