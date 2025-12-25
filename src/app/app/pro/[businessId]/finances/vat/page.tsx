import { redirect } from 'next/navigation';

export default async function VatRedirect({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  redirect(`/app/pro/${businessId}/finances?tab=vat`);
}
