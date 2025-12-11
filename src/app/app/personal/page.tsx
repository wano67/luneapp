// src/app/app/personal/page.tsx
import { AppShell } from '../AppShell';
import { Card } from '@/components/ui/card';

export default function PersonalSpacePage() {
  return (
    <AppShell
      title="Espace perso"
      description="Pilote tes finances personnelles, budgets et objectifs. Section à venir."
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
