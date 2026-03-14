'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePageTitle } from '@/lib/hooks/usePageTitle';

export default function BusinessTeamSettingsRedirect() {
  usePageTitle('Équipe');
  const params = useParams();
  const router = useRouter();
  const businessId = (params?.businessId ?? '') as string;

  useEffect(() => {
    router.replace(`/app/pro/${businessId}/team`);
  }, [router, businessId]);

  return null;
}
