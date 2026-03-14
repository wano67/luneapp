'use client';

import { use } from 'react';
import NewProjectForm from '@/components/pro/projects/NewProjectForm';
import { usePageTitle } from '@/lib/hooks/usePageTitle';

type Props = { params: Promise<{ businessId: string }> };

export default function NewProjectPage({ params }: Props) {
  usePageTitle('Nouveau projet');
  const { businessId } = use(params);
  return <NewProjectForm businessId={businessId} />;
}
