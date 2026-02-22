import { redirect } from 'next/navigation';

type Props = { params: Promise<{ businessId: string }> };

export default async function CatalogRoutePage({ params }: Props) {
  const { businessId } = await params;
  redirect(`/app/pro/${businessId}/services`);
}
