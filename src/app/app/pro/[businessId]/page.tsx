// src/app/app/pro/[businessId]/page.tsx

type BusinessDashboardPageProps = {
  params: { businessId: string };
};

export default function BusinessDashboardPage({
  params,
}: BusinessDashboardPageProps) {
  const { businessId } = params;

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
          Pro · Entreprise #{businessId}
        </p>
        <h1 className="text-xl font-semibold text-slate-50">
          Dashboard entreprise (à venir)
        </h1>
        <p className="text-sm text-slate-400">
          Cette page sera le cockpit de l&apos;activité : projets en cours, CA du
          mois, marge, charge équipe, trésorerie, etc.
        </p>
      </header>

      <section className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4">
        <p className="text-sm text-slate-400">
          Pour l&apos;instant, utilise la sidebar pour accéder aux prospects.
        </p>
        <p className="text-xs text-slate-500">
          Prochaines étapes : lier ici les données Projets, Finances, Tâches, SOP…
        </p>
      </section>
    </div>
  );
}
