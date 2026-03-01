import type { Metadata } from 'next';
import { PricingCards } from '@/components/marketing/PricingCards';
import { SectionHeader } from '@/components/ui/section-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Faq } from '@/components/marketing/Faq';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Tarifs • Lune',
  description: 'Des plans clairs pour démarrer ou passer en mode équipe.',
};

type Row = { feature: string; essential: string | boolean; pro: string | boolean; team: string | boolean };

const comparisonRows: Row[] = [
  { feature: 'Espace personnel (Wallet)', essential: true, pro: true, team: true },
  { feature: 'Comptes & transactions', essential: true, pro: true, team: true },
  { feature: 'Budgets & épargne', essential: true, pro: true, team: true },
  { feature: 'Espace pro (Studio)', essential: '1 entreprise', pro: 'Illimité', team: 'Illimité' },
  { feature: 'Prospects & pipeline', essential: true, pro: true, team: true },
  { feature: 'Clients & projets', essential: true, pro: true, team: true },
  { feature: 'Devis & factures', essential: true, pro: true, team: true },
  { feature: 'Stock & catalogue', essential: true, pro: true, team: true },
  { feature: 'Focus (vue croisée)', essential: true, pro: true, team: true },
  { feature: 'Membres d\'équipe', essential: '—', pro: 'Jusqu\'à 5', team: 'Illimité' },
  { feature: 'Rôles & permissions', essential: '—', pro: true, team: true },
  { feature: 'Intégrations avancées', essential: '—', pro: '—', team: true },
  { feature: 'Support prioritaire', essential: '—', pro: true, team: true },
  { feature: 'SLA & onboarding dédié', essential: '—', pro: '—', team: true },
];

const pricingFaq = [
  {
    question: 'Puis-je passer d\'un plan à l\'autre ?',
    answer: 'Oui, à tout moment. La facturation est mensuelle et annulable sans engagement.',
  },
  {
    question: 'Y a-t-il une période d\'essai ?',
    answer: 'Le plan Essentiel est gratuit pour toujours. Le plan Pro propose un essai de 14 jours sans carte bancaire.',
  },
  {
    question: 'Mes données sont-elles sûres ?',
    answer: 'Oui. Authentification sécurisée, cookies HttpOnly, CSRF sur toutes les mutations, rate-limit sur les endpoints sensibles.',
  },
  {
    question: 'Le plan Equipe est-il adapté aux associations ?',
    answer: 'Oui. Contactez-nous pour discuter de votre cas d\'usage et obtenir un devis adapté.',
  },
];

function CellValue({ value }: { value: string | boolean }) {
  if (value === true) {
    return <span className="text-[var(--success)]">✓</span>;
  }
  if (value === false || value === '—') {
    return <span className="text-[var(--text-faint)]">—</span>;
  }
  return <span className="text-sm text-[var(--text-secondary)]">{value}</span>;
}

export default function PricingPage() {
  return (
    <div className="space-y-12">
      <SectionHeader
        title="Des plans clairs et progressifs"
        description="Commencez gratuitement, passez à Pro quand vos besoins augmentent, contactez-nous pour Equipe."
      />

      <PricingCards />

      {/* Comparison table */}
      <section className="space-y-4">
        <SectionHeader title="Comparaison détaillée" />
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">Fonctionnalité</th>
                <th className="px-4 py-3 text-center font-medium text-[var(--text-muted)]">Essentiel</th>
                <th className="px-4 py-3 text-center font-semibold text-[var(--accent)]">
                  Pro
                  <Badge variant="pro" className="ml-2 align-middle text-xs">Populaire</Badge>
                </th>
                <th className="px-4 py-3 text-center font-medium text-[var(--text-muted)]">Equipe</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, i) => (
                <tr
                  key={row.feature}
                  className={`border-b border-[var(--border)] last:border-0 ${
                    i % 2 === 0 ? 'bg-[var(--surface)]' : 'bg-[var(--surface-2)]'
                  }`}
                >
                  <td className="px-4 py-3 text-[var(--text)]">{row.feature}</td>
                  <td className="px-4 py-3 text-center">
                    <CellValue value={row.essential} />
                  </td>
                  <td className="px-4 py-3 text-center font-medium">
                    <CellValue value={row.pro} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <CellValue value={row.team} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Benefits */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            title: 'Facturation simple',
            desc: 'Mensuelle, annulable. TVA adaptée. Pas de frais cachés.',
          },
          {
            title: 'Sécurité incluse',
            desc: 'Auth unifiée, CSRF, rate-limit, no-store sur les endpoints sensibles.',
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

      {/* FAQ pricing */}
      <section className="space-y-4">
        <SectionHeader title="Questions fréquentes sur les tarifs" />
        <Faq items={pricingFaq} />
      </section>

      {/* CTA */}
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
