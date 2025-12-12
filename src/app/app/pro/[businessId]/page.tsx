// src/app/app/pro/[businessId]/page.tsx

type BusinessDashboardPageProps = {
  params: Promise<{
    businessId: string;
  }>;
};

export default async function BusinessDashboardPage({
  params,
}: BusinessDashboardPageProps) {
  const { businessId } = await params;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
          Pro · Dashboard entreprise
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">
          Espace PRO — entreprise #{businessId}
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Vue d&apos;ensemble de ton entreprise. Tu pourras ici combiner clients,
          projets, finances et process.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Projets &amp; pipeline
          </h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Ce bloc accueillera plus tard un résumé des projets en cours, jalons,
            retards et charge de l’équipe.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Finances &amp; trésorerie
          </h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Ici viendront les indicateurs clés : CA, marge, runway, cashflow.
          </p>
        </div>
      </div>

      <p className="text-xs text-[var(--text-secondary)]">
        Navigation détaillée à gauche : clients, prospects, projets, services,
        tâches, finances et process.
      </p>
    </div>
  );
}
