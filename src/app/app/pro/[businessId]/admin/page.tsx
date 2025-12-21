'use client';

import { useParams } from 'next/navigation';
import { ComingSoon } from '../../../ComingSoon';

export default function AdminPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  return (
    <ComingSoon
      title="Admin / Conformité"
      description="Documents et échéances administratives seront ajoutés prochainement."
      backHref={`/app/pro/${businessId}`}
      backLabel="Retour au dashboard"
    />
  );
}
