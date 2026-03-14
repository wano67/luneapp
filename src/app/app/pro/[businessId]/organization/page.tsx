'use client';

import { use } from 'react';
import OrganizationPage from '@/components/pro/organization/OrganizationPage';
import { usePageTitle } from '@/lib/hooks/usePageTitle';

type Props = { params: Promise<{ businessId: string }> };

export default function Page({ params }: Props) {
  usePageTitle('Organisation');
  const { businessId } = use(params);
  return <OrganizationPage businessId={businessId} />;
}
