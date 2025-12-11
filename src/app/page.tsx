import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Link from 'next/link';

export default function PublicLandingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      {/* Header marketing simple */}
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 md:px-6">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
              Lune
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/login"
              className="hidden text-slate-300 hover:text-white md:inline"
            >
              Connexion
            </Link>
            <Button asChild size="sm">
              <Link href="/register">Créer un compte</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-16">
        <div className="grid gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)] md:items-center">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Public
            </p>
            <h1 className="text-3xl font-semibold md:text-4xl">
              Lune — ton OS perso &amp; pro.
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-slate-400 md:text-base">
              Un seul espace pour piloter ton activité professionnelle,
              tes finances personnelles et ta performance globale. Crée un compte
              pour accéder à l&apos;app interne sécurisée.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild>
                <Link href="/login">Se connecter</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/register">Créer un compte</Link>
              </Button>
            </div>
          </div>

          {/* Carte récap des 3 espaces */}
          <Card className="border-slate-800/80 bg-slate-900/60 p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              App interne
            </p>
            <ul className="space-y-3 text-sm text-slate-300">
              <li>
                <span className="font-semibold text-blue-300">PRO</span> — clients,
                projets, services et finances d&apos;entreprise.
              </li>
              <li>
                <span className="font-semibold text-emerald-300">PERSO</span> — comptes,
                budgets, dépenses et objectifs personnels.
              </li>
              <li>
                <span className="font-semibold text-rose-300">PERFORMANCE</span> — vue
                globale PRO ↔ PERSO, runway et alignement.
              </li>
            </ul>
            <p className="text-xs text-slate-500">
              Tu pourras ensuite enrichir chaque espace avec tes données, dashboards
              et process.
            </p>
          </Card>
        </div>
      </section>
    </main>
  );
}
