import { redirect } from 'next/navigation';

type Props = { params: Promise<{ businessId: string; productId: string }> };

export default async function ProductDetailRoute({ params }: Props) {
  const { businessId, productId } = await params;
  redirect(`/app/pro/${businessId}/stock/${productId}`);
}
