import { redirect } from 'next/navigation';

type BusinessSubPageProps = {
  params: Promise<{ businessId: string }>;
};

export default async function BusinessDashAdminProcessPage({
  params,
}: BusinessSubPageProps) {
  const { businessId } = await params;
  redirect(`/app/pro/${businessId}/process`);
}
