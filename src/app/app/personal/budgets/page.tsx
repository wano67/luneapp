import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function PersoBudgetsPage() {
  return (
    <div className="space-y-4">
      <Card className="space-y-2 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
          Bientôt
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">
          Budgets &amp; catégories
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          La gestion des budgets arrive. En attendant, utilisez les comptes et transactions.
        </p>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-2 p-4">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Aller aux actions utiles</p>
          <p className="text-xs text-[var(--text-secondary)]">Comptes et transactions restent actifs.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/app/personal/comptes">Ouvrir les comptes</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/app/personal/transactions">Voir les transactions</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
