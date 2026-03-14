'use client';

import { useParams } from 'next/navigation';
import { usePageTitle } from '@/lib/hooks/usePageTitle';
import { ComingSoon } from '../../../../ComingSoon';

export default function AdminDeadlinesPage() {
  usePageTitle('Échéances');
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  return (
    <ComingSoon
      title="Échéances & conformité"
      description="Calendrier des échéances (TVA, assurances, etc.) sera disponible prochainement."
      backHref={`/app/pro/${businessId}`}
      backLabel="Retour au dashboard"
    />
  );
}
