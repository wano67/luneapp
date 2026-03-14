'use client';

import { redirect } from 'next/navigation';
import { usePageTitle } from '@/lib/hooks/usePageTitle';

export default function SubscriptionsPage() {
  usePageTitle('Abonnements');
  redirect('/app/personal/budgets');
}
