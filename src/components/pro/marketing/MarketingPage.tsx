"use client";

import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ProPageShell } from '@/components/pro/ProPageShell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Props = { businessId: string };

const TABS = [
  { key: 'campaigns', label: 'Campagnes' },
  { key: 'social', label: 'Réseaux sociaux' },
  { key: 'interactions', label: 'Interactions' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function MarketingPage({ businessId }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requestedTab = (searchParams?.get('tab') ?? TABS[0].key) as TabKey;
  const currentTab = useMemo(
    () => (TABS.some((t) => t.key === requestedTab) ? requestedTab : TABS[0].key),
    [requestedTab]
  );

  const handleTabChange = (key: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('tab', key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const content = useMemo(() => {
    switch (currentTab) {
      case 'campaigns':
        return (
          <PlaceholderCard
            title="Campagnes"
            description="Créez et suivez les campagnes email ou SMS dès que la connexion aux outils sera active."
          />
        );
      case 'social':
        return (
          <PlaceholderCard
            title="Réseaux sociaux"
            description="Planifiez vos posts et pilotez les canaux clés depuis cette vue centralisée."
          />
        );
      case 'interactions':
        return (
          <PlaceholderCard
            title="Interactions"
            description="Analysez les réponses et mettez en place vos séquences de nurturing."
          />
        );
      default:
        return null;
    }
  }, [currentTab]);

  return (
    <ProPageShell
      backHref={`/app/pro/${businessId}`}
      backLabel="Dashboard"
      title="Marketing"
      subtitle="Campagnes, réseaux sociaux et interactions clients."
      actions={
        <Button disabled className="cursor-not-allowed opacity-70">
          Créer une campagne (bientôt)
        </Button>
      }
      tabs={TABS}
      activeTab={currentTab}
      onTabChange={handleTabChange}
    >
      <div className="space-y-4">{content}</div>
    </ProPageShell>
  );
}

function PlaceholderCard({ title, description }: { title: string; description: string }) {
  return (
    <Card className="p-4 text-sm text-[var(--text-secondary)]">
      <p className="text-[var(--text-primary)]">{title}</p>
      <p className="mt-1 text-[var(--text-secondary)]">{description}</p>
    </Card>
  );
}
