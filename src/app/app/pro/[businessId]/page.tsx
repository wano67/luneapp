// src/app/app/pro/[businessId]/page.tsx
import { redirect } from 'next/navigation';

type BusinessPageProps = {
  params: Promise<{ businessId: string }>;
};

export default async function BusinessRedirectPage({ params }: BusinessPageProps) {
  const { businessId } = await params;
  redirect(`/app/pro/${businessId}/dash-entreprise`);
}
