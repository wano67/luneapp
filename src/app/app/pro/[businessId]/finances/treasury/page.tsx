import { redirect } from 'next/navigation';

export default async function TreasuryRedirect({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  redirect(`/app/pro/${businessId}/finances?tab=treasury`);
}
