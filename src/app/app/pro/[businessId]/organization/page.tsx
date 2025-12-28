import OrganizationPage from '@/components/pro/organization/OrganizationPage';

type Props = { params: Promise<{ businessId: string }> };

export default async function Page({ params }: Props) {
  const { businessId } = await params;
  return <OrganizationPage businessId={businessId} />;
}
