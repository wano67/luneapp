// src/app/app/pro/[businessId]/references/numbering/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function NumberingPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
          PRO · References · Numbering
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Numérotation</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Configurer les préfixes et compteurs des documents pour Business #{businessId}.
        </p>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Prefix factures" placeholder="INV-" />
          <Input label="Prochain numéro facture" type="number" placeholder="1024" />
          <Input label="Prefix devis" placeholder="EST-" />
          <Input label="Prochain numéro devis" type="number" placeholder="550" />
        </div>
        <p className="text-xs text-[var(--text-secondary)]">API à venir — enregistrement désactivé.</p>
        <div className="flex justify-end">
          <Button variant="outline" disabled>
            Enregistrer (bientôt)
          </Button>
        </div>
      </Card>
    </div>
  );
}
