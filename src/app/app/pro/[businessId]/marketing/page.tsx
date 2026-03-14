'use client';

import { use } from 'react';
import MarketingPage from '@/components/pro/marketing/MarketingPage';
import { usePageTitle } from '@/lib/hooks/usePageTitle';

type Props = { params: Promise<{ businessId: string }> };

export default function Page({ params }: Props) {
  usePageTitle('Marketing');
  const { businessId } = use(params);
  return <MarketingPage businessId={businessId} />;
}
