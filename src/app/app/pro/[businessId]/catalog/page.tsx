import { CatalogPage } from '@/components/pro/catalog/CatalogPage';

type Props = { params: Promise<{ businessId: string }> };

export default async function CatalogRoutePage({ params }: Props) {
  const { businessId } = await params;
  return <CatalogPage businessId={businessId} />;
}
