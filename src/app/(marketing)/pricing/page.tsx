import type { Metadata } from 'next';
import { PricingCards } from '@/components/marketing/PricingCards';
import { SectionHeader } from '@/components/ui/section-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Tarifs • Lune',
  description: 'Des plans clairs pour démarrer ou passer en mode équipe.',
};

export default function PricingPage() {
  return (
    <div className="space-y-10">
      <SectionHeader
        title="Des plans clairs et progressifs"
        description="Commencez gratuitement, passez à Pro quand vos besoins augmentent, contactez-nous pour Equipe."
      />

      <PricingCards />

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            title: 'Facturation simple',
            desc: 'Mensuelle, annulable. TVA adaptée. Pas de frais cachés.',
          },
          {
            title: 'Sécurité incluse',
            desc: 'Auth unifiée, CSRF, rate-limit, request-id/no-store là où il faut.',
          },
          {
            title: 'Support prioritaire Pro',
            desc: 'Aide produit, onboarding, et réponses rapides par mail.',
          },
        ].map((item) => (
          <Card key={item.title} className="border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="text-base font-semibold text-[var(--text)]">{item.title}</div>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{item.desc}</p>
          </Card>
        ))}
      </div>

      <Card className="flex flex-col gap-3 border-[var(--border)] bg-[var(--surface-2)] p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-lg font-semibold text-[var(--text)]">Questions sur les tarifs ?</div>
          <p className="text-sm text-[var(--text-secondary)]">
            Parlons des besoins de votre équipe et des intégrations spécifiques.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/register">Démarrer</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/contact">Nous contacter</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
