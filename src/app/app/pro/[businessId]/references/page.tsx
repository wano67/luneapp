'use client';

import { useParams } from 'next/navigation';
import { ComingSoon } from '../../../ComingSoon';

export default function ReferencesPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  return (
    <ComingSoon
      title="Référentiels"
      description="Catégories, tags, automations et numérotation seront configurables prochainement."
      backHref={`/app/pro/${businessId}`}
      backLabel="Retour au dashboard"
    />
  );
}
