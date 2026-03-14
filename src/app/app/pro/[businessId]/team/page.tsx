'use client';

import { useParams } from 'next/navigation';
import TeamPage from './TeamPage';
import { usePageTitle } from '@/lib/hooks/usePageTitle';

export default function TeamPageRoute() {
  usePageTitle('Équipe');
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  return <TeamPage businessId={businessId} />;
}
