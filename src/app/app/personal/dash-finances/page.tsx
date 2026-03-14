'use client';

import { redirect } from 'next/navigation';
import { usePageTitle } from '@/lib/hooks/usePageTitle';

export default function PersonalDashFinancesRedirect() {
  usePageTitle('Dashboard finances');
  redirect('/app/personal/transactions');
}
