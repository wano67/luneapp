'use client';

import { useParams } from 'next/navigation';
import { ReferenceList } from '../ReferenceList';

export default function TagsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  return <ReferenceList businessId={businessId} type="TAG" />;
}
