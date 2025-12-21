'use client';

import { useParams } from 'next/navigation';
import { ComingSoon } from '../../../../ComingSoon';

export default function VatPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  return (
    <ComingSoon
      title="TVA / Déclarations"
      description="Gestion des périodes de TVA arrive bientôt."
      backHref={`/app/pro/${businessId}/finances`}
      backLabel="Retour finances"
    />
  );
}
