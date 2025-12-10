// src/app/app/page.tsx

export default function AppHomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-10">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
            OS
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold">
            Espace principal
          </h1>
          <p className="text-sm md:text-base text-slate-400 max-w-xl">
            Choisis un espace pour gérer ton activité pro, tes finances perso
            ou analyser ta performance globale.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {/* PRO */}
          <a
            href="/app/pro"
            className="group rounded-2xl border border-slate-800 bg-slate-900/40 p-5 shadow-sm transition hover:border-blue-500/70 hover:bg-slate-900"
          >
            <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 text-xs font-semibold text-blue-300">
              PRO
            </div>
            <h2 className="mb-2 text-lg font-semibold text-slate-50">
              Espace PRO
            </h2>
            <p className="text-sm text-slate-400">
              Clients, prospects, projets, services, tâches et finances de ton
              activité.
            </p>
          </a>

          {/* PERSO */}
          <a
            href="/app/personal"
            className="group rounded-2xl border border-slate-800 bg-slate-900/40 p-5 shadow-sm transition hover:border-emerald-500/70 hover:bg-slate-900"
          >
            <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-semibold text-emerald-300">
              PERSO
            </div>
            <h2 className="mb-2 text-lg font-semibold text-slate-50">
              Espace perso
            </h2>
            <p className="text-sm text-slate-400">
              Comptes bancaires, transactions, budgets, épargne et objectifs
              personnels.
            </p>
          </a>

          {/* PERFORMANCE */}
          <a
            href="/app/performance"
            className="group rounded-2xl border border-slate-800 bg-slate-900/40 p-5 shadow-sm transition hover:border-rose-500/70 hover:bg-slate-900"
          >
            <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/10 text-xs font-semibold text-rose-300">
              PERF
            </div>
            <h2 className="mb-2 text-lg font-semibold text-slate-50">
              Performance
            </h2>
            <p className="text-sm text-slate-400">
              Analyses croisées PRO / PERSO, rentabilité, runway et alignement.
            </p>
          </a>
        </section>
      </div>
    </main>
  );
}
