'use client';

import { useParams } from 'next/navigation';
import { ComingSoon } from '../../../../ComingSoon';

export default function BillingSettingsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  return (
    <ComingSoon
      title="Paramètres de facturation"
      description="Coordonnées, IBAN et préfixes de factures seront configurables prochainement."
      backHref={`/app/pro/${businessId}`}
      backLabel="Retour au dashboard"
    />
  );
}
