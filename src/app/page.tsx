import Link from 'next/link';

export default function PublicLandingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-16">
      <div className="mx-auto max-w-5xl space-y-12">
        <header className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            Public
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold">
            Lune, ton OS personnel et pro.
          </h1>
          <p className="text-sm md:text-base text-slate-400 max-w-2xl leading-relaxed">
            Cette page est publique. Connecte-toi pour accéder à l&apos;app
            interne, structuré en trois espaces : PRO, PERSO et PERFORMANCE.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400"
            >
              Se connecter
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-50 transition hover:border-blue-500/60 hover:text-white"
            >
              Créer un compte
            </Link>
            <Link
              href="/app"
              className="inline-flex items-center justify-center rounded-lg border border-slate-800 px-4 py-2 text-sm font-semibold text-slate-50 transition hover:border-emerald-500/60 hover:text-white"
            >
              Accéder à l&apos;app interne
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <LandingCard
            title="Espace PRO"
            description="Clients, prospects, projets, services et finances de ton activité."
            href="/app/pro"
            badge="PRO"
            badgeColor="bg-blue-500/10 text-blue-300"
          />
          <LandingCard
            title="Espace perso"
            description="Comptes bancaires, budgets, épargne et objectifs personnels."
            href="/app/personal"
            badge="PERSO"
            badgeColor="bg-emerald-500/10 text-emerald-300"
          />
          <LandingCard
            title="Performance"
            description="Analyses croisées PRO ↔ PERSO, runway et pilotage global."
            href="/app/performance"
            badge="PERF"
            badgeColor="bg-rose-500/10 text-rose-300"
          />
        </section>
      </div>
    </main>
  );
}

type LandingCardProps = {
  title: string;
  description: string;
  href: string;
  badge: string;
  badgeColor: string;
};

function LandingCard({
  title,
  description,
  href,
  badge,
  badgeColor,
}: LandingCardProps) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/40 p-5 shadow-sm transition hover:border-slate-600 hover:bg-slate-900"
    >
      <div className="space-y-3">
        <div
          className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${badgeColor}`}
        >
          {badge}
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-50">{title}</h2>
          <p className="text-sm text-slate-400">{description}</p>
        </div>
      </div>
      <span className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400 transition group-hover:text-blue-300">
        Accéder →
      </span>
    </Link>
  );
}
