import AgendaPage from '@/components/pro/agenda/AgendaPage';

type Props = { params: Promise<{ businessId: string }> };

export default async function Page({ params }: Props) {
  const { businessId } = await params;
  return <AgendaPage businessId={businessId} />;
}
