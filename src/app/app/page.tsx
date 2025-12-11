import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import { AppShell } from './AppShell';

const spaces = [
  {
    href: '/app/pro',
    title: 'Espace PRO',
    description:
      'Clients, prospects, projets, services et finances de ton activité.',
    badge: { label: 'PRO', variant: 'pro' as const },
  },
  {
    href: '/app/personal',
    title: 'Espace perso',
    description: 'Comptes bancaires, budgets, épargne et objectifs personnels.',
    badge: { label: 'PERSO', variant: 'personal' as const },
  },
  {
    href: '/app/performance',
    title: 'Performance',
    description: 'Analyses croisées PRO ↔ PERSO, runway, alignement global.',
    badge: { label: 'PERF', variant: 'performance' as const },
  },
];

export default function AppHomePage() {
  return (
    <AppShell
      currentSection={null}
      title="OS interne"
      description="Choisis un espace pour piloter ton activité pro, tes finances perso ou ta performance."
      sidebarItems={[]}
    >
      <section className="grid gap-4 md:grid-cols-3">
        {spaces.map((space) => (
          <Card
            key={space.href}
            className="group flex h-full flex-col justify-between border-slate-800/80 bg-slate-900/40 p-5 transition hover:border-slate-700 hover:bg-slate-900/60"
          >
            <div className="space-y-3">
              <Badge variant={space.badge.variant}>{space.badge.label}</Badge>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-slate-50">
                  {space.title}
                </h2>
                <p className="text-sm text-slate-400">{space.description}</p>
              </div>
            </div>
            <Link
              href={space.href}
              className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400 transition group-hover:text-blue-300"
            >
              Entrer →
            </Link>
          </Card>
        ))}
      </section>
    </AppShell>
  );
}
