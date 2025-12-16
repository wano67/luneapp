import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SectionHeader } from '@/components/ui/section-header';
import { KpiCard } from '@/components/ui/kpi-card';
import { FeatureGrid } from '@/components/marketing/FeatureGrid';
import { PricingCards } from '@/components/marketing/PricingCards';
import { Faq } from '@/components/marketing/Faq';
import { TestimonialStrip } from '@/components/marketing/TestimonialStrip';

export const metadata: Metadata = {
  title: 'Lune • OS perso & pro',
  description:
    'Lune, un espace calme pour orchestrer finances personnelles et activité pro : prospects, clients, projets, finances, sécurité par défaut.',
  openGraph: {
    title: 'Lune • OS perso & pro',
    description:
      'Lune, un espace calme pour orchestrer finances personnelles et activité pro : prospects, clients, projets, finances, sécurité par défaut.',
  },
};

const features = [
  {
    title: 'Cockpit PRO',
    category: 'PRO' as const,
    description: 'Vue centrale par entreprise : prospects, clients, projets, finances, actions rapides.',
  },
  {
    title: 'Pipeline prospects',
    category: 'PRO' as const,
    description: 'Étapes configurables, changement de statut en un clic, notes et suivi estimations.',
  },
  {
    title: 'Clients & projets',
    category: 'PRO' as const,
    description: 'Listes mobiles, création rapide, pages détail pour le pilotage (projets, finances).',
  },
  {
    title: 'Finances personnelles',
    category: 'PERSO' as const,
    description: 'Comptes, catégories, transactions, budgets et import CSV pour suivre le quotidien.',
  },
  {
    title: 'Performance croisée',
    category: 'PERFORMANCE' as const,
    description: 'Vue d’ensemble PRO + PERSO : runway, alignement et suivi des objectifs.',
  },
  {
    title: 'Sécurité par défaut',
    category: 'SECURITE' as const,
    description: 'Cookies HttpOnly, middleware, CSRF sur mutations, rate-limit, request-id sur erreurs.',
  },
];

const faqItems = [
  {
    question: 'Puis-je utiliser Lune seulement pour le pro ou seulement pour le perso ?',
    answer:
      'Oui. Les espaces sont indépendants : vous pouvez activer uniquement le PRO, le perso, ou les deux.',
  },
  {
    question: 'Comment l’app sécurise mes données ?',
    answer:
      'Cookies HttpOnly, middleware d’auth, CSRF sur toutes les mutations, rate-limit et request-id/no-store sur les endpoints sensibles.',
  },
  {
    question: 'Lune fonctionne-t-il sur mobile ?',
    answer:
      'Oui, l’App Router est mobile-first : navigation, listes et modals sont testées sur petits écrans.',
  },
  {
    question: 'Peut-on inviter des collaborateurs ?',
    answer:
      'Oui. Les entreprises PRO gèrent rôles et invitations. Les pages invites et switch d’entreprise sont intégrés.',
  },
  {
    question: 'Comment tester avant de payer ?',
    answer:
      'Le plan Essentiel est gratuit pour démarrer, et le plan Pro est disponible avec essai 14 jours.',
  },
  {
    question: 'Existe-t-il des intégrations ?',
    answer:
      'Les pages process/services/tasks sont déjà structurées. Les intégrations avancées sont prévues sur le plan Equipe.',
  },
];

export default function HomePage() {
  return (
    <div className="space-y-14">
      <section className="grid gap-10 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)] md:items-center">
        <div className="space-y-6">
          <Badge variant="neutral" className="w-fit">
            Nouvelle génération d’OS
          </Badge>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
              Lune, l’OS calme pour piloter tes finances perso et ton business pro.
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-[var(--text-secondary)]">
              Un seul espace pour gérer prospects, clients, projets, finances et dépenses
              personnelles. Sécurité par défaut, mobile-friendly, prêt pour le quotidien.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/register">Créer un compte</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/features">Découvrir les fonctionnalités</Link>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard label="Prospects suivis" value="2 400+" delta="+18% ce mois" trend="up" />
            <KpiCard label="Clients actifs" value="620" delta="+42 nouveaux" trend="neutral" />
            <KpiCard label="Temps gagné" value="6h / semaine" delta="Automations & cockpit" />
          </div>
        </div>
        <Card className="border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg shadow-[var(--shadow-float)]/25">
          <SectionHeader
            title="Un seul hub, deux espaces"
            description="Accès rapide aux modules clé, du pro au perso."
          />
          <div className="mt-5 space-y-4 text-sm text-[var(--text)]">
            <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
              <Badge variant="pro">PRO</Badge>
              <div>
                <div className="font-semibold">Entreprises, prospects, projets</div>
                <p className="text-[var(--text-secondary)]">
                  Cockpit par entreprise, pipeline prospects, clients, projets, finances et invites.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
              <Badge variant="personal">PERSO</Badge>
              <div>
                <div className="font-semibold">Comptes et transactions</div>
                <p className="text-[var(--text-secondary)]">
                  Comptes, budgets, catégories, import CSV, vision claire du runway personnel.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
              <Badge variant="performance">PERFORMANCE</Badge>
              <div>
                <div className="font-semibold">Vue croisée</div>
                <p className="text-[var(--text-secondary)]">
                  Runway global et alignement pro/perso, pour garder le cap sans bruit.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <TestimonialStrip />

      <FeatureGrid
        title="Tout ce dont vous avez besoin"
        description="Une couverture fonctionnelle claire : PRO pour l’agence/indé, PERSO pour le quotidien."
        items={features}
      />

      <section className="space-y-6">
        <SectionHeader title="Comment ça marche ?" description="3 étapes pour être opérationnel." />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: '1. Créez votre compte',
              desc: 'Inscription en quelques secondes, choisissez vos espaces (PRO, PERSO).',
            },
            {
              title: '2. Ajoutez entreprises et comptes',
              desc: 'Créez une entreprise, invitez votre équipe, importez vos transactions perso.',
            },
            {
              title: '3. Pilotez au quotidien',
              desc: 'Utilisez le cockpit, changez de pipeline, suivez vos finances et vos objectifs.',
            },
          ].map((step) => (
            <Card key={step.title} className="border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="text-base font-semibold text-[var(--text)]">{step.title}</div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{step.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-center">
        <div className="space-y-4">
          <SectionHeader
            title="Sécurité dès la conception"
            description="Les mêmes garde-fous que dans l’app : CSRF, auth unifiée, rate-limit, request-id."
          />
          <ul className="space-y-3 text-sm text-[var(--text-secondary)]">
            <li>• Cookies HttpOnly et middleware d’auth pour toutes les routes sensibles.</li>
            <li>• CSRF sur les mutations, rate-limit et cache-control no-store quand nécessaire.</li>
            <li>• Request-id surfacés côté client pour diagnostiquer facilement.</li>
          </ul>
          <Button asChild>
            <Link href="/security">En savoir plus</Link>
          </Button>
        </div>
        <Card className="border-[var(--border)] bg-[var(--surface-2)] p-6">
          <SectionHeader
            title="Plans clairs"
            description="Passez d’Essentiel à Pro quand vous êtes prêt, ou contactez-nous pour Equipe."
          />
          <div className="mt-4 grid gap-3">
            <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">Essentiel</div>
                <p className="text-xs text-[var(--text-secondary)]">Workspace perso + 1 business</p>
              </div>
              <div className="text-lg font-semibold">Gratuit</div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">Pro</div>
                <p className="text-xs text-[var(--text-secondary)]">Multi-entreprises, finances, équipe</p>
              </div>
              <div className="text-lg font-semibold">24€ / mois</div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">Equipe</div>
                <p className="text-xs text-[var(--text-secondary)]">Intégrations, permissions avancées</p>
              </div>
              <div className="text-lg font-semibold">Sur devis</div>
            </div>
          </div>
        </Card>
      </section>

      <PricingCards />

      <Faq items={faqItems} />

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-md shadow-[var(--shadow-float)]/25">
        <h2 className="text-2xl font-semibold text-[var(--text)]">Prêt à travailler au calme ?</h2>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          Crée ton compte et accède à l’app interne. Lune est conçu pour rester simple, sûr et mobile.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/register">Créer un compte</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">Se connecter</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
