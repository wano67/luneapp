import { redirect } from 'next/navigation';

type BusinessSubPageProps = {
  params: Promise<{ businessId: string }>;
};

// Legacy route: redirect to the consolidated dashboard to avoid duplicate cockpits.
export default async function BusinessDashEntreprisePage({ params }: BusinessSubPageProps) {
  const { businessId } = await params;
  redirect(`/app/pro/${businessId}`);
}

