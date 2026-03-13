import type { Metadata } from 'next';
import { ScrollReveal } from '@/components/marketing/ScrollReveal';
import { StaggerChildren } from '@/components/marketing/StaggerChildren';
import { SectionHeader } from '@/components/ui/section-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'À propos • Pivot',
  description: 'Pivot : un outil simple pour les indépendants et petites équipes qui gèrent pro et perso.',
};

export default function AboutPage() {
  return (
    <div className="space-y-16">
      {/* Vision */}
      <ScrollReveal>
        <section className="space-y-4">
          <SectionHeader
            variant="marketing"
            title="Pourquoi Pivot ?"
            description="Un outil simple pour ceux qui jonglent entre pro et perso."
          />
          <p className="max-w-2xl text-base leading-relaxed text-[var(--text-secondary)]">
            Les freelances et gérants de petites structures passent leur temps entre outils pro,
            tableurs personnels et apps bancaires. Le résultat : des données éparpillées et du
            temps perdu. Pivot réunit tout en un seul endroit — simplement.
          </p>
        </section>
      </ScrollReveal>

      {/* Pour qui */}
      <section className="space-y-4">
        <ScrollReveal>
          <SectionHeader title="Pour qui ?" />
        </ScrollReveal>
        <StaggerChildren className="grid gap-4 md:grid-cols-2">
          <Card className="feature-card-lift border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="text-base font-semibold text-[var(--text)]">Indépendants</div>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              Freelances, consultants, créatifs : un espace pour gérer vos clients, projets
              et factures, et un autre pour vos finances personnelles.
            </p>
          </Card>
          <Card className="feature-card-lift border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="text-base font-semibold text-[var(--text)]">Petites équipes</div>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              Studios, agences, associations : invitez vos collaborateurs, partagez les projets
              et gardez une vision claire de votre activité.
            </p>
          </Card>
        </StaggerChildren>
      </section>

      {/* Ce qui est prêt */}
      <ScrollReveal>
        <section className="space-y-4">
          <SectionHeader title="Ce qui est déjà prêt" />
          <StaggerChildren className="grid gap-3 md:grid-cols-2">
            {[
              'Prospects, clients et projets',
              'Devis, factures et suivi des paiements',
              'Comptabilité : grand livre, bilan, TVA, export FEC',
              'Finances personnelles, budgets et épargne',
              'Synchronisation bancaire automatique',
              'Stock et catalogue produits',
              'Gestion d\'équipe et de rôles',
              'Documents et trousseau sécurisé',
              'Tâches, sous-tâches et checklists',
              'Portail client (lien de partage projet)',
              'Calendrier avec sync iCal et CalDAV',
              'Notifications et rappels automatiques',
              'Export RGPD et PDF',
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-secondary)]"
              >
                <span className="mt-0.5 shrink-0 text-[var(--success)]">✓</span>
                {item}
              </div>
            ))}
          </StaggerChildren>
        </section>
      </ScrollReveal>

      {/* CTA */}
      <ScrollReveal>
        <Card className="flex flex-col gap-3 border-[var(--border)] bg-[var(--surface-2)] p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-lg font-semibold text-[var(--text)]">Envie d&apos;essayer ?</div>
            <p className="text-sm text-[var(--text-secondary)]">
              Créez votre compte et découvrez Pivot par vous-même.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/waitlist">Rejoindre la liste</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/contact">Nous écrire</Link>
            </Button>
          </div>
        </Card>
      </ScrollReveal>
    </div>
  );
}
