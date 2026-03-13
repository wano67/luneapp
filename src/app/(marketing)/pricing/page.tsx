import type { Metadata } from 'next';
import { ScrollReveal } from '@/components/marketing/ScrollReveal';
import { SectionHeader } from '@/components/ui/section-header';
import { Card } from '@/components/ui/card';
import { StaggerChildren } from '@/components/marketing/StaggerChildren';
import { WaitlistForm } from '@/components/marketing/WaitlistForm';
import { Faq } from '@/components/marketing/Faq';

export const metadata: Metadata = {
  title: 'Tarifs • Pivot',
  description: 'Des plans clairs pour démarrer gratuitement ou passer en mode équipe. Tarifs dévoilés au lancement.',
};

const plans = [
  {
    name: 'Essentiel',
    tagline: 'Pour d\u00e9marrer',
    features: [
      'Finances personnelles + sync bancaire',
      '1 entreprise PRO',
      'Devis, factures et comptabilit\u00e9',
      'Support mail',
    ],
  },
  {
    name: 'Pro',
    tagline: 'Pour les ind\u00e9pendants et agences',
    highlight: true,
    features: [
      'Entreprises illimit\u00e9es',
      'Prospects, clients et projets',
      'Comptabilit\u00e9 et export FEC',
      'Jusqu\'\u00e0 5 membres par entreprise',
      'Support prioritaire',
    ],
  },
  {
    name: '\u00c9quipe',
    tagline: 'Pour les \u00e9quipes ambitieuses',
    features: [
      'Membres illimit\u00e9s',
      'Permissions avanc\u00e9es',
      'Support d\u00e9di\u00e9 et onboarding',
      'SLA personnalis\u00e9',
    ],
  },
];

const includedFeatures = [
  'Espace personnel complet',
  'Comptes, transactions et sync bancaire',
  'Budgets, \u00e9pargne et abonnements',
  'Prospects, clients et projets',
  'Devis, factures et comptabilit\u00e9',
  'Stock, catalogue et documents',
  'T\u00e2ches et calendrier',
  'Portail client (lien de partage)',
  'Sync iCal / CalDAV',
  'Notifications automatiques',
];

const pricingFaq = [
  {
    question: 'Quand les tarifs seront-ils disponibles ?',
    answer: 'Les tarifs d\u00e9finitifs seront annonc\u00e9s au lancement. Inscrivez-vous \u00e0 la liste d\u2019attente pour \u00eatre inform\u00e9 en premier.',
  },
  {
    question: 'Y aura-t-il un plan gratuit ?',
    answer: 'Oui. Le plan Essentiel sera gratuit, sans limite de dur\u00e9e, pour commencer \u00e0 utiliser Pivot d\u00e8s le jour 1.',
  },
  {
    question: 'Puis-je changer de plan \u00e0 tout moment ?',
    answer: 'Oui. La facturation sera mensuelle et sans engagement.',
  },
  {
    question: 'Mes donn\u00e9es sont-elles prot\u00e9g\u00e9es ?',
    answer: 'Oui. Authentification s\u00e9curis\u00e9e, donn\u00e9es chiffr\u00e9es, acc\u00e8s contr\u00f4l\u00e9 par r\u00f4les.',
  },
];

export default function PricingPage() {
  return (
    <div className="space-y-16">
      <SectionHeader
        variant="marketing"
        title="Des plans adapt\u00e9s \u00e0 chaque \u00e9tape"
        description="Tarifs d\u00e9voil\u00e9s au lancement. Rejoignez la liste pour \u00eatre pr\u00e9venu."
      />

      {/* Plan cards — no prices */}
      <StaggerChildren className="grid gap-4 lg:grid-cols-3" staggerMs={120}>
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={`feature-card-lift flex h-full flex-col gap-4 border-[var(--border)] bg-[var(--surface)] p-6 ${
              plan.highlight ? 'border-[var(--accent-strong)] shadow-md shadow-[var(--shadow-float)]/30' : ''
            }`}
          >
            <div>
              <div className="text-sm font-semibold text-[var(--text-muted)]">{plan.name}</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--text)]">
                Bient&ocirc;t
              </div>
              <div className="text-xs text-[var(--text-faint)]">{plan.tagline}</div>
            </div>
            <div className="space-y-2 text-sm">
              {plan.features.map((feat) => (
                <div key={feat} className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" />
                  <span className="leading-relaxed text-[var(--text-secondary)]">{feat}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </StaggerChildren>

      {/* Included in all plans */}
      <ScrollReveal>
        <section className="space-y-4">
          <SectionHeader variant="marketing" title="Inclus dans tous les plans" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {includedFeatures.map((feat) => (
              <div key={feat} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <span className="text-[var(--success)]">&check;</span>
                {feat}
              </div>
            ))}
          </div>
        </section>
      </ScrollReveal>

      <Faq items={pricingFaq} />

      {/* CTA */}
      <ScrollReveal>
        <Card className="flex flex-col gap-4 border-[var(--border)] bg-[var(--surface-2)] p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-lg font-semibold text-[var(--text)]">Soyez pr&eacute;venu au lancement</div>
            <p className="text-sm text-[var(--text-secondary)]">
              Inscrivez-vous pour d&eacute;couvrir les tarifs en avant-premi&egrave;re.
            </p>
          </div>
          <div className="w-full max-w-sm">
            <WaitlistForm />
          </div>
        </Card>
      </ScrollReveal>
    </div>
  );
}
