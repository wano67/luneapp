import type { Metadata } from 'next';
import { ScrollReveal } from '@/components/marketing/ScrollReveal';
import { StaggerChildren } from '@/components/marketing/StaggerChildren';
import { SectionHeader } from '@/components/ui/section-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Fonctionnalités • Pivot',
  description: 'Découvrez les outils PRO et personnels de Pivot pour gérer votre activité et vos finances.',
};

const proFeatures = [
  {
    title: 'Prospects et pipeline',
    description: 'Pipeline visuel, suivi des étapes, probabilités et budgets estimés.',
  },
  {
    title: 'Clients et projets',
    description: 'Fiches client, projets avec services, suivi d\'avancement et échéances.',
  },
  {
    title: 'Devis et factures',
    description: 'Création rapide, export PDF, suivi des paiements et numérotation automatique.',
  },
  {
    title: 'Comptabilité',
    description: 'Grand livre, bilan, TVA et export FEC pour votre comptable.',
  },
  {
    title: 'Trésorerie et prévisions',
    description: 'Suivi des flux, projections de trésorerie et scan de justificatifs.',
  },
  {
    title: 'Tâches et organisation',
    description: 'Tâches, sous-tâches, checklists, assignations et suivi hebdomadaire.',
  },
  {
    title: 'Stock et catalogue',
    description: 'Produits, services, gestion des quantités et mouvements de stock.',
  },
  {
    title: 'Documents et trousseau',
    description: 'Stockez vos documents par projet et vos identifiants en toute sécurité.',
  },
  {
    title: 'Équipe et rôles',
    description: 'Invitez des membres, assignez des rôles et des pôles d\'organisation.',
  },
  {
    title: 'Portail client',
    description: 'Partagez un lien projet avec votre client : avancement, documents et factures.',
  },
  {
    title: 'Calendrier et sync',
    description: 'Événements, rappels et synchronisation iCal / CalDAV avec vos outils.',
  },
  {
    title: 'Notifications',
    description: 'Alertes automatiques : tâches en retard, échéances, relances client.',
  },
];

const persoFeatures = [
  {
    title: 'Comptes bancaires',
    description: 'Comptes courants, épargne, investissements. Synchronisation bancaire automatique.',
  },
  {
    title: 'Transactions',
    description: 'Saisie manuelle, import CSV ou sync bancaire. Catégorisation et filtres.',
  },
  {
    title: 'Budgets',
    description: 'Budgets mensuels par catégorie, suivi des dépenses et alertes de dépassement.',
  },
  {
    title: 'Épargne et objectifs',
    description: 'Fixez des objectifs d\'épargne et suivez votre progression au fil du temps.',
  },
  {
    title: 'Abonnements',
    description: 'Suivez vos abonnements récurrents et gardez le contrôle sur vos charges fixes.',
  },
  {
    title: 'Calendrier personnel',
    description: 'Événements, rappels de paiement et jalons d\'épargne.',
  },
];

export default function FeaturesPage() {
  return (
    <div className="space-y-16">
      <ScrollReveal>
        <SectionHeader
          variant="marketing"
          title="Tout ce dont vous avez besoin"
          description="Des outils simples pour gérer votre activité professionnelle et vos finances personnelles."
        />
      </ScrollReveal>

      {/* Pro features */}
      <section className="space-y-6">
        <ScrollReveal>
          <h2 className="text-xl font-semibold text-[var(--text)]">Espace Pro</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Pour les indépendants, agences et petites équipes.
          </p>
        </ScrollReveal>
        <StaggerChildren className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {proFeatures.map((item) => (
            <Card key={item.title} className="feature-card-lift border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="text-base font-semibold text-[var(--text)]">{item.title}</div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{item.description}</p>
            </Card>
          ))}
        </StaggerChildren>
      </section>

      {/* Perso features */}
      <section className="space-y-6">
        <ScrollReveal>
          <h2 className="text-xl font-semibold text-[var(--text)]">Espace Personnel</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Pour suivre vos finances personnelles sans bruit.
          </p>
        </ScrollReveal>
        <StaggerChildren className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {persoFeatures.map((item) => (
            <Card key={item.title} className="feature-card-lift border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="text-base font-semibold text-[var(--text)]">{item.title}</div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{item.description}</p>
            </Card>
          ))}
        </StaggerChildren>
      </section>

      {/* CTA */}
      <ScrollReveal>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-6">
          <div>
            <div className="text-lg font-semibold text-[var(--text)]">Prêt à essayer ?</div>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Créez un compte gratuit et configurez votre espace en quelques minutes.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/waitlist">Rejoindre la liste</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/pricing">Voir les tarifs</Link>
            </Button>
          </div>
        </div>
      </ScrollReveal>
    </div>
  );
}
