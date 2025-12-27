import { ProjectWorkspace } from '@/components/pro/projects/ProjectWorkspace';

type Props = { params: Promise<{ businessId: string; projectId: string }> };

export default async function ProjectDetailPage({ params }: Props) {
  const { businessId, projectId } = await params;
  return <ProjectWorkspace businessId={businessId} projectId={projectId} />;
}
