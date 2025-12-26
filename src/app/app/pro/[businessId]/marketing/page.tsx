import MarketingPage from '@/components/pro/marketing/MarketingPage';

type Props = { params: Promise<{ businessId: string }> };

export default async function Page({ params }: Props) {
  const { businessId } = await params;
  return <MarketingPage businessId={businessId} />;
}
