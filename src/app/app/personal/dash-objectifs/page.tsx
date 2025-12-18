import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function PersoDashObjectifsPage() {
  return (
    <div className="space-y-4">
      <Card className="space-y-2 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
          Bientôt
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">
          Objectifs &amp; runway
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Le suivi des objectifs arrivera ici. Utilisez les transactions pour suivre vos flux.
        </p>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-2 p-4">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Accès rapide</p>
          <p className="text-xs text-[var(--text-secondary)]">Rejoignez les sections actives.</p>
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
