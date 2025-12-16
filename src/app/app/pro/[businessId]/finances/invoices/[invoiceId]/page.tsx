// src/app/app/pro/[businessId]/finances/invoices/[invoiceId]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function InvoiceDetailStubPage() {
  const params = useParams();
  const invoiceId = (params?.invoiceId ?? '') as string;

  return (
    <div className="space-y-4">
      <Card className="space-y-2 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
          Facture — stub
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Facture #{invoiceId}</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Détail facture : client, montant, statut, échéance.
        </p>
        {/* TODO: API facture detail (GET/PATCH /api/pro/businesses/{businessId}/finances/invoices/{invoiceId}) */}
      </Card>

      <Card className="space-y-2 border-dashed border-[var(--border)] bg-transparent p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Montant & statut</p>
          <Badge variant="neutral">À venir</Badge>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          TODO: montant HT/TTC, échéance, statut paiement.
        </p>
      </Card>

      <Card className="space-y-2 border-dashed border-[var(--border)] bg-transparent p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Lignes</p>
          <Badge variant="neutral">À venir</Badge>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          TODO: lignes de facture, taxes, remise.
        </p>
      </Card>

      <Button variant="outline" disabled>
        Actions facture (désactivé)
      </Button>
    </div>
  );
}
