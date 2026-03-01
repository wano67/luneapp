import AccountingPage from '@/components/pro/accounting/AccountingPage';

type Props = { params: Promise<{ businessId: string }> };

export default async function FinancesPage({ params }: Props) {
  const { businessId } = await params;
  return <AccountingPage businessId={businessId} />;
}
