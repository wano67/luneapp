import { redirect } from 'next/navigation';

type Props = { params: Promise<{ businessId: string }> };

export default async function AdminDocumentsPage({ params }: Props) {
  const { businessId } = await params;
  redirect(`/app/pro/${businessId}/documents`);
}
