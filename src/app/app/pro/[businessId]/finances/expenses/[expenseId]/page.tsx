// src/app/app/pro/[businessId]/finances/expenses/[expenseId]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function ExpenseDetailStubPage() {
  const params = useParams();
  const expenseId = (params?.expenseId ?? '') as string;

  return (
    <div className="space-y-4">
      <Card className="space-y-2 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
          Dépense — stub
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Dépense #{expenseId}</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Détail dépense : fournisseur, catégorie, montant, justificatif.
        </p>
        {/* TODO: API dépense detail (GET/PATCH /api/pro/businesses/{businessId}/finances/expenses/{expenseId}) */}
      </Card>

      <Card className="space-y-2 border-dashed border-[var(--border)] bg-transparent p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Montant & statut</p>
          <Badge variant="neutral">À venir</Badge>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          TODO: montant TTC, catégorie, mode de paiement.
        </p>
      </Card>

      <Card className="space-y-2 border-dashed border-[var(--border)] bg-transparent p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Justificatif</p>
          <Badge variant="neutral">À venir</Badge>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          TODO: upload reçu + lien pièce jointe.
        </p>
      </Card>

      <Button variant="outline" disabled>
        Actions dépense (désactivé)
      </Button>
    </div>
  );
}
