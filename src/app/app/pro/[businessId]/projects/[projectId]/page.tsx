import ProjectHub from '@/components/pro/projects/ProjectHub';

type Props = { params: Promise<{ businessId: string; projectId: string }> };

export default async function Page({ params }: Props) {
  const { businessId, projectId } = await params;
  return <ProjectHub businessId={businessId} projectId={projectId} />;
}
