import { redirect } from 'next/navigation';

export default function DashEntrepriseRedirect({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  return params.then(({ businessId }) => redirect(`/app/pro/${businessId}`));
}
