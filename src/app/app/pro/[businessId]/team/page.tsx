'use client';

import { useParams } from 'next/navigation';
import TeamPage from './TeamPage';

export default function TeamPageRoute() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  return <TeamPage businessId={businessId} />;
}
