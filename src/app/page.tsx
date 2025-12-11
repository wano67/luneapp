// src/app/page.tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const spaces = [
  {
    title: 'Espace PRO',
    description:
      'Clients, prospects, projets, services et finances de ton activité.',
    href: '/app/pro',
    badge: { label: 'PRO', variant: 'pro' as const },
  },
  {
    title: 'Espace perso',
    description: 'Comptes bancaires, budgets, épargne et objectifs personnels.',
    href: '/app/personal',
    badge: { label: 'PERSO', variant: 'personal' as const },
  },
  {
    title: 'Performance',
    description: 'Analyses croisées PRO ↔ PERSO, runway et pilotage global.',
    href: '/app/performance',
    badge: { label: 'PERF', variant: 'performance' as const },
  },
];

export default function PublicLandingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-16">
      <div className="mx-auto max-w-5xl space-y-12">
        <header className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Public
          </p>
          <h1 className="text-3xl font-semibold md:text-4xl">
            Lune — OS perso &amp; pro
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-400 md:text-base">
            Accède à un espace unifié pour piloter ton activité pro, tes finances
            perso et ta performance globale. Connecte-toi pour entrer dans l’app
            interne sécurisée.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild>
              <Link href="/login">Se connecter</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/register">Créer un compte</Link>
            </Button>
            <Link
              href="/app"
              className="text-sm font-semibold text-blue-300 hover:text-blue-200"
            >
              Accéder à l&apos;app interne →
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {spaces.map((space) => (
            <Card
              key={space.title}
              className="group flex h-full flex-col justify-between border-slate-800/80 bg-slate-900/40 p-5 transition hover:border-slate-700 hover:bg-slate-900/60"
            >
              <div className="space-y-3">
                <Badge variant={space.badge.variant}>{space.badge.label}</Badge>
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-slate-50">
                    {space.title}
                  </h2>
                  <p className="text-sm text-slate-400">
                    {space.description}
                  </p>
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
      </div>
    </main>
  );
}
