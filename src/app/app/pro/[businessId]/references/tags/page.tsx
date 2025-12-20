'use client';

import { useParams } from 'next/navigation';
import { ComingSoon } from '../../../../ComingSoon';

export default function TagsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  return (
    <ComingSoon
      title="Références · Tags"
      description="Les tags globaux seront configurables prochainement."
      backHref={`/app/pro/${businessId}`}
      backLabel="Retour au dashboard"
    />
  );
}
