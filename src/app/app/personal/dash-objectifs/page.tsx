'use client';

import { redirect } from 'next/navigation';
import { usePageTitle } from '@/lib/hooks/usePageTitle';

export default function PersonalDashObjectifsRedirect() {
  usePageTitle('Objectifs');
  redirect('/app/personal/budgets');
}
