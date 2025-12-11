type BusinessSubPageProps = {
  params: { businessId: string };
};

export default function BusinessDashFinancesPage({
  params,
}: BusinessSubPageProps) {
  const { businessId } = params;

  return (
    <div className="space-y-2">
      <h1 className="text-lg font-semibold text-slate-50">
        Dashboard Finances Pro — à venir
      </h1>
      <p className="text-sm text-slate-400">
        Cette page sera dédiée à la section &quot;Dashboard Finances Pro&quot; pour
        l&apos;entreprise #{businessId}.
      </p>
      <p className="text-xs text-slate-500">
        Placeholder temporaire, en attendant la mise en place de la vraie base
        de données et des vues.
      </p>
    </div>
  );
}
