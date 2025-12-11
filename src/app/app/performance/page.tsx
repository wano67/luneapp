import { Card } from '@/components/ui/card';
import { AppShell } from '../AppShell';

export default function PerformanceSpacePage() {
  const sidebarItems = [
    { href: '/app/performance', label: 'Vue d’ensemble' },
    // plus tard: Performance Pro, Perso, Alignement, etc.
  ];

  return (
    <AppShell
      currentSection="performance"
      title="Espace performance"
      description="Analyses croisées PRO/PERSO, runway et alignement global. Section à enrichir."
      sidebarItems={sidebarItems}
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
