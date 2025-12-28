import { redirect } from 'next/navigation';

type Props = { params: Promise<{ businessId: string }> };

export default async function FinancesPage({ params }: Props) {
  const { businessId } = await params;
  redirect(`/app/pro/${businessId}/accounting`);
}
