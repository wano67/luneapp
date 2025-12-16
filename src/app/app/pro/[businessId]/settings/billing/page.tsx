// src/app/app/pro/[businessId]/settings/billing/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function BusinessBillingSettingsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
          PRO · Settings · Billing
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Facturation</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Coordonnées de facturation, devise et préférences d’émission pour Business #{businessId}.
        </p>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Raison sociale" placeholder="Ex: StudioFief SAS" />
          <Input label="Adresse" placeholder="12 rue..." />
          <Input label="Devise" placeholder="EUR" />
          <Input label="Prefix factures" placeholder="INV-" />
          <Input label="Prochain numéro" placeholder="1024" type="number" />
          <Input label="IBAN (optionnel)" placeholder="FR76..." />
        </div>
        <p className="text-xs text-[var(--text-secondary)]">
          API à venir — enregistrement désactivé pour l’instant.
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
