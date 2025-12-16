// src/app/app/pro/[businessId]/settings/taxes/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function BusinessTaxesSettingsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
          PRO · Settings · Taxes
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Taxes & TVA</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Configurer la TVA (taux, période) et les obligations fiscales de Business #{businessId}.
        </p>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Taux TVA (%)" placeholder="20" type="number" />
          <Input label="Période TVA" placeholder="Mensuelle / Trimestrielle" />
          <Input label="Numéro TVA" placeholder="FRXX..." />
          <Input label="Pays" placeholder="France" />
        </div>
        <p className="text-xs text-[var(--text-secondary)]">
          API à venir — valeurs non sauvegardées pour l’instant.
        </p>
        <div className="flex justify-end">
          <Button disabled variant="outline">
            Enregistrer (bientôt)
          </Button>
        </div>
      </Card>
    </div>
  );
}
