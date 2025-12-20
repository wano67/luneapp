'use client';

import { useParams } from 'next/navigation';
import { ComingSoon } from '../../../../ComingSoon';

export default function TreasuryPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  return (
    <ComingSoon
      title="Trésorerie"
      description="Projection de trésorerie en cours de préparation."
      backHref={`/app/pro/${businessId}/finances`}
      backLabel="Retour finances"
    />
  );
}
