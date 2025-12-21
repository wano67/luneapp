// src/app/app/pro/[businessId]/process/[processId]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { ComingSoon } from '../../../../ComingSoon';

export default function ProcessDetailStubPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const processId = (params?.processId ?? '') as string;

  return (
    <ComingSoon
      title={`Process #${processId}`}
      description="Détail d’un SOP : étapes, responsables, assets (à venir)."
      backHref={`/app/pro/${businessId}`}
      backLabel="Retour au dashboard"
    />
  );
}
