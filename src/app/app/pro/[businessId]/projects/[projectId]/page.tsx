'use client';

import { use } from 'react';
import { ProjectWorkspace } from '@/components/pro/projects/ProjectWorkspace';
import { usePageTitle } from '@/lib/hooks/usePageTitle';

type Props = { params: Promise<{ businessId: string; projectId: string }> };

export default function ProjectDetailPage({ params }: Props) {
  usePageTitle('Projet');
  const { businessId, projectId } = use(params);
  return <ProjectWorkspace businessId={businessId} projectId={projectId} />;
}
