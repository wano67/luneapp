'use client';

import { useParams } from 'next/navigation';
import { ComingSoon } from '../../../../ComingSoon';

export default function AdminDocumentsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  return (
    <ComingSoon
      title="Documents administratifs"
      description="Suivi des documents et pièces jointes arrivera bientôt."
      backHref={`/app/pro/${businessId}`}
      backLabel="Retour au dashboard"
    />
  );
}
