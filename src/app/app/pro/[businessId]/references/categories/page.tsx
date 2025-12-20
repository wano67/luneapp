'use client';

import { useParams } from 'next/navigation';
import { ComingSoon } from '../../../../ComingSoon';

export default function CategoriesPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  return (
    <ComingSoon
      title="Références · Catégories"
      description="Gestion des catégories centralisées arrive bientôt."
      backHref={`/app/pro/${businessId}`}
      backLabel="Retour au dashboard"
    />
  );
}
