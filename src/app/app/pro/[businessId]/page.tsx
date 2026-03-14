'use client';

import { use } from 'react';
import ProDashboard from '@/components/pro/ProDashboard';
import { usePageTitle } from '@/lib/hooks/usePageTitle';

type BusinessDashboardPageProps = {
  params: Promise<{ businessId: string }>;
};

export default function BusinessDashboardPage({ params }: BusinessDashboardPageProps) {
  usePageTitle('Dashboard');
  const { businessId } = use(params);
  return <ProDashboard businessId={businessId} />;
}
