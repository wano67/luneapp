'use client';

import { useParams } from 'next/navigation';
import { ComingSoon } from '../../../../ComingSoon';

export default function ForecastingPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  return (
    <ComingSoon
      title="Prévisions"
      description="Le forecasting sera ajouté dès que les APIs seront prêtes."
      backHref={`/app/pro/${businessId}/finances`}
      backLabel="Retour finances"
    />
  );
}
