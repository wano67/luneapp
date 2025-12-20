'use client';

import { useParams } from 'next/navigation';
import { ComingSoon } from '../../../../ComingSoon';

export default function TaxesSettingsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  return (
    <ComingSoon
      title="Paramètres TVA/Taxes"
      description="Configuration TVA et localisation fiscale arrivera bientôt."
      backHref={`/app/pro/${businessId}`}
      backLabel="Retour au dashboard"
    />
  );
}
