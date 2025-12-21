'use client';

import { useParams } from 'next/navigation';
import { ComingSoon } from '../../../ComingSoon';

export default function BusinessSettingsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  return (
    <ComingSoon
      title="Paramètres entreprise"
      description="Paramètres billing/taxes/intégrations/permissions seront branchés sur l’API prochainement."
      backHref={`/app/pro/${businessId}`}
      backLabel="Retour au dashboard"
    />
  );
}
