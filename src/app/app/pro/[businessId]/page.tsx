import ProDashboard from '@/components/pro/ProDashboard';

export default function BusinessDashboardPage({ params }: { params: { businessId: string } }) {
  return <ProDashboard businessId={params.businessId} />;
}
