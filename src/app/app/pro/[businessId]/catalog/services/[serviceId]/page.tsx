import { ServiceDetailPage } from '@/components/pro/catalog/ServiceDetailPage';

type Props = { params: Promise<{ businessId: string; serviceId: string }> };

export default async function ServiceDetailRoute({ params }: Props) {
  const { businessId, serviceId } = await params;
  return <ServiceDetailPage businessId={businessId} serviceId={serviceId} />;
}
