'use client';

import { useParams } from 'next/navigation';
import { ReferenceList } from '../ReferenceList';
import { usePageTitle } from '@/lib/hooks/usePageTitle';

export default function NumberingPage() {
  usePageTitle('Numérotation');
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  return <ReferenceList businessId={businessId} type="NUMBERING" />;
}
