import ProDashboard from '@/components/pro/ProDashboard';

type BusinessDashboardPageProps = {
  params: Promise<{ businessId: string }>;
};

export default async function BusinessDashboardPage({ params }: BusinessDashboardPageProps) {
  const { businessId } = await params;
  return <ProDashboard businessId={businessId} />;
}
