import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type BusinessDashboardPageProps = {
  params: { businessId: string };
};

export default function BusinessDashboardPage({
  params,
}: BusinessDashboardPageProps) {
  const { businessId } = params;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <Card className="p-5 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          PRO • Entreprise
        </p>
        <h1 className="text-xl font-semibold text-slate-50">
          Tableau de bord entreprise #{businessId}
        </h1>
        <p className="text-sm text-slate-400">
          Vue d&apos;ensemble de ton activité. Les sections ci-dessous pointeront
          vers les sous-pages (prospects, clients, projets, finances…).
        </p>
      </Card>

      {/* Accès rapide aux sous-pages principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="p-4 flex flex-col justify-between">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-slate-100">
              Prospects
            </h2>
            <p className="text-xs text-slate-400">
              Gère les leads avant qu&apos;ils deviennent clients.
            </p>
          </div>
          <div className="mt-3">
            <Link href={`/app/pro/${businessId}/prospects`}>
              <Button size="sm" variant="outline">
                Ouvrir les prospects
              </Button>
            </Link>
          </div>
        </Card>

        {/* Tu pourras plus tard ajouter Clients, Projets, Finances, etc. */}
        <Card className="p-4 flex flex-col justify-between opacity-70">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-slate-100">
              Clients (à venir)
            </h2>
            <p className="text-xs text-slate-400">
              Base clients de l&apos;entreprise.
            </p>
          </div>
        </Card>

        <Card className="p-4 flex flex-col justify-between opacity-70">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-slate-100">
              Vue finances (à venir)
            </h2>
            <p className="text-xs text-slate-400">
              Synthèse CA, charges, marges et trésorerie.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
