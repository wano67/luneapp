import type { Metadata } from 'next';
import { SectionHeader } from '@/components/ui/section-header';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Politique de confidentialité • Lune',
  description: 'Comment Lune traite vos données.',
};

export default function PrivacyPage() {
  return (
    <div className="space-y-6">
      <SectionHeader title="Confidentialité" description="Vos données, notre responsabilité." />
      <Card className="space-y-4 border-[var(--border)] bg-[var(--surface)] p-6 text-sm leading-relaxed text-[var(--text-secondary)]">
        <p>
          Les données que vous stockez (prospects, clients, finances, transactions) restent
          privées. Nous utilisons des cookies techniques pour l’authentification (HttpOnly) et ne
          revendons aucune donnée.
        </p>
        <p>
          Vous pouvez demander la suppression de votre compte en nous écrivant. Les journaux
          techniques (request-id, erreurs) sont conservés pour le support et la sécurité.
        </p>
      </Card>
    </div>
  );
}
