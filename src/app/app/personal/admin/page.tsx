import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function PersoAdminPage() {
  return (
    <div className="space-y-4">
      <Card className="space-y-2 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
          Bientôt
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">
          Administratif personnel
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Les démarches administratives arriveront plus tard. Continuez via Comptes et Transactions.
        </p>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-2 p-4">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Actions disponibles</p>
          <p className="text-xs text-[var(--text-secondary)]">Suivi des comptes et transactions existants.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/app/personal/comptes">Comptes</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/app/personal/transactions">Transactions</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
