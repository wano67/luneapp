import NewProjectForm from '@/components/pro/projects/NewProjectForm';

type Props = { params: Promise<{ businessId: string }> };

export default async function NewProjectPage({ params }: Props) {
  const { businessId } = await params;
  return <NewProjectForm businessId={businessId} />;
}
