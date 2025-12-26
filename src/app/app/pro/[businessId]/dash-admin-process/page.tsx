import { redirect } from 'next/navigation';

export default function DashAdminProcessRedirect({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  return params.then(({ businessId }) => redirect(`/app/pro/${businessId}/process`));
}
