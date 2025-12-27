import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GuidedCtaCard } from '@/components/pro/shared/GuidedCtaCard';

type Props = {
  businessId: string;
  clientId: string | null;
  clientName: string | null;
};

export function ClientUpdatesBlock({ businessId, clientId, clientName }: Props) {
  if (!clientId) {
    return (
      <GuidedCtaCard
        title="Aucun client associé."
        description="Associer un client facilite le suivi et la communication."
        primary={{ label: 'Associer un client', href: `/app/pro/${businessId}/clients` }}
      />
    );
  }

  return (
    <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Client & communication</p>
          <p className="text-xs text-[var(--text-secondary)]">Dernière mise à jour client : —</p>
        </div>
        <Button asChild size="sm">
          <Link href={`/app/pro/${businessId}/clients/${clientId}`}>Envoyer une mise à jour</Link>
        </Button>
      </div>
      <div className="mt-3 text-sm text-[var(--text-secondary)]">
        <p className="text-[var(--text-primary)] font-semibold">{clientName ?? 'Client'}</p>
        <p>Aucune note de communication renseignée.</p>
      </div>
    </Card>
  );
}
