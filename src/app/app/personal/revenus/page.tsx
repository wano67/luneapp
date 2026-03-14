'use client';

import { redirect } from 'next/navigation';
import { usePageTitle } from '@/lib/hooks/usePageTitle';

export default function PersoRevenusPage() {
  usePageTitle('Revenus');
  redirect('/app/personal/transactions?type=INCOME');
}

