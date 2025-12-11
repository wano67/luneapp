import { Card } from '@/components/ui/card';
import { AppShell } from '../AppShell';

export default function PersonalSpacePage() {
  const sidebarItems = [
    { href: '/app/personal', label: 'Vue d’ensemble' },
    // plus tard: comptes, transactions, budgets, etc.
  ];

  return (
    <AppShell
      currentSection="personal"
      title="Espace perso"
      description="Pilote tes finances personnelles, budgets et objectifs. Section à enrichir."
      sidebarItems={sidebarItems}
    >
      <Card className="p-5">
        <p className="text-sm text-slate-400">
          Ici on mettra les données financières personnelles et les dashboards
          associés.
        </p>
      </Card>
    </AppShell>
  );
}
