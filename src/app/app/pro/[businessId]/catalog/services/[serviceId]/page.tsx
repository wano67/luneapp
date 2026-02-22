import { redirect } from 'next/navigation';

type Props = { params: Promise<{ businessId: string; serviceId: string }> };

export default async function ServiceDetailRoute({ params }: Props) {
  const { businessId, serviceId } = await params;
  redirect(`/app/pro/${businessId}/services/${serviceId}`);
}
