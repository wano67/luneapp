// src/app/app/pro/[businessId]/process/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { ComingSoon } from '../../../ComingSoon';

export default function ProcessStubPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  return (
    <ComingSoon
      title="Process & SOP"
      description="La gestion des process et SOP sera disponible ultérieurement."
      backHref={`/app/pro/${businessId}`}
      backLabel="Retour au dashboard"
    />
  );
}
