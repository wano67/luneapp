"use client";

import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ProPageShell } from '@/components/pro/ProPageShell';
import { Card } from '@/components/ui/card';

type Props = { businessId: string };

const TABS = [
  { key: 'team', label: 'Équipe' },
  { key: 'tasks', label: 'Tâches' },
  { key: 'calendar', label: 'Calendrier' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function OrganizationPage({ businessId }: Props) {
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
      case 'team':
        return (
          <PlaceholderCard title="Organisation de l’équipe" description="Ajoutez des membres et répartissez les responsabilités du projet." />
        );
      case 'tasks':
        return (
          <PlaceholderCard
            title="Tâches par équipe"
            description="Suivez les tâches clés par squad et préparez vos workflows d’assignation."
          />
        );
      case 'calendar':
        return (
          <PlaceholderCard
            title="Calendrier partagé"
            description="Synchronisez les événements d’équipe et les jalons projet depuis vos outils existants."
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
      title="Organisation"
      subtitle="Équipe, tâches et calendrier internes."
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
