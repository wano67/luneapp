import { redirect } from 'next/navigation';

export default function DashFinancesRedirect({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  return params.then(({ businessId }) => redirect(`/app/pro/${businessId}/finances`));
}
