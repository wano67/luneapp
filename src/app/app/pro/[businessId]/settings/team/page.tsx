'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function BusinessTeamSettingsRedirect() {
  const params = useParams();
  const router = useRouter();
  const businessId = (params?.businessId ?? '') as string;

  useEffect(() => {
    router.replace(`/app/pro/${businessId}/team`);
  }, [router, businessId]);

  return null;
}
