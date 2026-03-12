import type { Metadata } from 'next';
import { PricingCards } from '@/components/marketing/PricingCards';
import { ScrollReveal } from '@/components/marketing/ScrollReveal';
import { SectionHeader } from '@/components/ui/section-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Faq } from '@/components/marketing/Faq';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Tarifs • Pivot',
  description: 'Des plans clairs pour démarrer gratuitement ou passer en mode équipe.',
};

type Row = { feature: string; essential: string | boolean; pro: string | boolean; team: string | boolean };

const comparisonRows: Row[] = [
  { feature: 'Espace personnel', essential: true, pro: true, team: true },
  { feature: 'Comptes, transactions et sync bancaire', essential: true, pro: true, team: true },
  { feature: 'Budgets, épargne et abonnements', essential: true, pro: true, team: true },
  { feature: 'Espace pro', essential: '1 entreprise', pro: 'Illimité', team: 'Illimité' },
  { feature: 'Prospects, clients et projets', essential: true, pro: true, team: true },
  { feature: 'Devis, factures et comptabilité', essential: true, pro: true, team: true },
  { feature: 'Stock, catalogue et documents', essential: true, pro: true, team: true },
  { feature: 'Tâches et calendrier', essential: true, pro: true, team: true },
  { feature: 'Portail client (lien de partage)', essential: true, pro: true, team: true },
  { feature: 'Sync iCal / CalDAV', essential: true, pro: true, team: true },
  { feature: 'Membres d\'équipe', essential: '—', pro: 'Jusqu\'à 5', team: 'Illimité' },
  { feature: 'Rôles et permissions', essential: '—', pro: true, team: true },
  { feature: 'Support prioritaire', essential: '—', pro: true, team: true },
];

const pricingFaq = [
  {
    question: 'Puis-je changer de plan à tout moment ?',
    answer: 'Oui. La facturation est mensuelle et sans engagement.',
  },
  {
    question: 'Y a-t-il une période d\'essai ?',
    answer: 'Le plan Essentiel est gratuit. Le plan Pro offre un essai de 14 jours sans carte bancaire.',
  },
  {
    question: 'Mes données sont-elles protégées ?',
    answer: 'Oui. Authentification sécurisée, données chiffrées, accès contrôlé par rôles.',
  },
];

function CellValue({ value }: { value: string | boolean }) {
  if (value === true) return <span className="text-[var(--success)]">✓</span>;
  if (value === false || value === '—') return <span className="text-[var(--text-faint)]">—</span>;
  return <span className="text-sm text-[var(--text-secondary)]">{value}</span>;
}

export default function PricingPage() {
  return (
    <div className="space-y-16">
      <SectionHeader
        variant="marketing"
        title="Des tarifs simples et progressifs"
        description="Commencez gratuitement, évoluez quand vos besoins grandissent."
      />

      <PricingCards />

      {/* Comparison table */}
      <ScrollReveal>
        <section className="space-y-4">
          <SectionHeader variant="marketing" title="Comparaison détaillée" />
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">Fonctionnalité</th>
                  <th className="px-4 py-3 text-center font-medium text-[var(--text-muted)]">Essentiel</th>
                  <th className="px-4 py-3 text-center font-semibold text-[var(--accent)]">
                    Pro
                    <Badge variant="pro" className="ml-2 align-middle text-xs">Populaire</Badge>
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-[var(--text-muted)]">Équipe</th>
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
                    <td className="px-4 py-3 text-center"><CellValue value={row.essential} /></td>
                    <td className="px-4 py-3 text-center font-medium"><CellValue value={row.pro} /></td>
                    <td className="px-4 py-3 text-center"><CellValue value={row.team} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </ScrollReveal>

      <Faq items={pricingFaq} />

      {/* CTA */}
      <ScrollReveal>
        <Card className="flex flex-col gap-3 border-[var(--border)] bg-[var(--surface-2)] p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-lg font-semibold text-[var(--text)]">Une question sur les tarifs ?</div>
            <p className="text-sm text-[var(--text-secondary)]">
              Contactez-nous pour discuter de vos besoins.
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
      </ScrollReveal>
    </div>
  );
}
