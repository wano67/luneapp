import { ProductDetailPage } from '@/components/pro/catalog/ProductDetailPage';

type Props = { params: Promise<{ businessId: string; productId: string }> };

export default async function ProductDetailRoute({ params }: Props) {
  const { businessId, productId } = await params;
  return <ProductDetailPage businessId={businessId} productId={productId} />;
}
