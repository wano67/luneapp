import { redirect } from 'next/navigation';

export default async function PaymentsRedirect({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  redirect(`/app/pro/${businessId}/finances?tab=payments`);
}
