import { redirect } from 'next/navigation';

type Props = { params: Promise<{ businessId: string }> };

export default async function ClientsPage({ params }: Props) {
  const { businessId } = await params;
  redirect(`/app/pro/${businessId}/agenda`);
}
