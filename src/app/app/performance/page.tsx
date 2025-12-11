// src/app/app/performance/page.tsx
import { AppShell } from '../AppShell';
import { Card } from '@/components/ui/card';

export default function PerformanceSpacePage() {
  return (
    <AppShell
      title="Espace performance"
      description="Analyses croisées PRO/PERSO, runway et alignement global. Section à venir."
    >
      <Card className="p-5">
        <p className="text-sm text-slate-400">
          Ici on mettra les vues de performance globale et l&apos;alignement PRO ↔
          PERSO.
        </p>
      </Card>
    </AppShell>
  );
}
