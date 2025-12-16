import type { Metadata } from 'next';
import { SectionHeader } from '@/components/ui/section-header';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Conditions générales • Lune',
  description: 'Conditions d’utilisation du service Lune.',
};

export default function TermsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader title="Conditions d’utilisation" description="Version courte et lisible." />
      <Card className="space-y-4 border-[var(--border)] bg-[var(--surface)] p-6 text-sm leading-relaxed text-[var(--text-secondary)]">
        <p>
          Lune est proposé tel quel. En créant un compte, vous acceptez de respecter les lois
          applicables et de ne pas abuser du service (fraude, spam, attaques). Les entreprises et
          données que vous ajoutez restent les vôtres.
        </p>
        <p>
          Nous pouvons suspendre un compte en cas d’abus ou de non-paiement. Les changements
          importants seront communiqués. Pour toute question, écrivez-nous via la page Contact.
        </p>
      </Card>
    </div>
  );
}
