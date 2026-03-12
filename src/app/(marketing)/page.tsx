import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { Faq } from '@/components/marketing/Faq';
import { ScrollReveal } from '@/components/marketing/ScrollReveal';
import { StaggerChildren } from '@/components/marketing/StaggerChildren';

export const metadata: Metadata = {
  title: 'Pivot • Gérez votre activité pro et vos finances perso',
  description:
    'Pivot réunit la gestion de votre activité professionnelle et vos finances personnelles en un seul espace simple et sécurisé.',
  openGraph: {
    title: 'Pivot • Gérez votre activité pro et vos finances perso',
    description:
      'Pivot réunit la gestion de votre activité professionnelle et vos finances personnelles en un seul espace simple et sécurisé.',
  },
};

const faqItems = [
  {
    question: 'Puis-je utiliser Pivot seulement pour le pro ou seulement pour le perso ?',
    answer:
      'Oui. Les espaces sont indépendants : activez le pro, le perso, ou les deux selon vos besoins.',
  },
  {
    question: 'Pivot fonctionne-t-il sur mobile ?',
    answer:
      'Oui. L\'interface est pensée mobile-first : tout fonctionne sur smartphone comme sur ordinateur.',
  },
  {
    question: 'Peut-on inviter des collaborateurs ?',
    answer:
      'Oui. Chaque entreprise peut accueillir des membres avec des rôles différents (admin, membre, viewer).',
  },
  {
    question: 'Comment tester avant de payer ?',
    answer:
      'Le plan Essentiel est gratuit. Le plan Pro offre un essai de 14 jours sans carte bancaire.',
  },
];

export default function HomePage() {
  return (
    <div className="space-y-20">
      {/* ── Hero ── */}
      <section className="flex flex-col items-center text-center pt-8 md:pt-16">
        <ScrollReveal animation="reveal-up">
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight md:text-5xl lg:text-6xl">
            Votre activité pro et vos finances perso, enfin réunies.
          </h1>
        </ScrollReveal>
        <ScrollReveal animation="reveal-up" delay={100}>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--text-secondary)]">
            Pivot est l&apos;espace unique pour piloter vos clients, projets, factures
            et suivre vos dépenses personnelles. Simple, sécurisé, accessible.
          </p>
        </ScrollReveal>
        <ScrollReveal animation="reveal-up" delay={200}>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/register">Commencer gratuitement</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/features">Voir les fonctionnalités</Link>
            </Button>
          </div>
        </ScrollReveal>
      </section>

      {/* ── 3 value props ── */}
      <StaggerChildren className="grid gap-6 md:grid-cols-3">
        {[
          {
            title: 'Espace Pro',
            desc: 'Prospects, clients, projets, devis et factures. Tout pour piloter votre activité au quotidien.',
          },
          {
            title: 'Espace Perso',
            desc: 'Comptes, transactions, budgets et épargne. Gardez une vue claire sur vos finances personnelles.',
          },
          {
            title: 'Simple et sécurisé',
            desc: 'Pas de configuration complexe. Vos données sont protégées, votre interface reste épurée.',
          },
        ].map((item) => (
          <Card key={item.title} className="feature-card-lift border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="text-lg font-semibold text-[var(--text)]">{item.title}</div>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{item.desc}</p>
          </Card>
        ))}
      </StaggerChildren>

      {/* ── Comment ça marche ── */}
      <section className="space-y-6">
        <ScrollReveal>
          <SectionHeader
            variant="marketing"
            title="Opérationnel en 3 étapes"
            description="Créez votre compte, ajoutez votre activité, et pilotez."
          />
        </ScrollReveal>
        <StaggerChildren className="grid gap-6 md:grid-cols-3">
          {[
            {
              step: '1',
              title: 'Créez votre compte',
              desc: 'Inscription gratuite en quelques secondes.',
            },
            {
              step: '2',
              title: 'Ajoutez votre activité',
              desc: 'Créez une entreprise et invitez votre équipe.',
            },
            {
              step: '3',
              title: 'Pilotez au quotidien',
              desc: 'Gérez clients, projets et finances depuis un seul endroit.',
            },
          ].map((item) => (
            <Card key={item.step} className="feature-card-lift border-[var(--border)] bg-[var(--surface)] p-6">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ background: 'var(--accent)' }}
              >
                {item.step}
              </div>
              <div className="mt-3 text-base font-semibold text-[var(--text)]">{item.title}</div>
              <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">{item.desc}</p>
            </Card>
          ))}
        </StaggerChildren>
      </section>

      {/* ── Pricing teaser ── */}
      <ScrollReveal>
        <section className="space-y-6">
          <SectionHeader
            variant="marketing"
            title="Des tarifs simples"
            description="Commencez gratuitement, évoluez quand vous en avez besoin."
          />
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="feature-card-lift border-[var(--border)] bg-[var(--surface)] p-5 text-center">
              <div className="text-sm font-medium text-[var(--text-secondary)]">Essentiel</div>
              <div className="mt-1 text-2xl font-bold text-[var(--text)]">Gratuit</div>
              <p className="mt-2 text-xs text-[var(--text-faint)]">1 entreprise, espace perso</p>
            </Card>
            <Card className="feature-card-lift border-[var(--accent-strong)] bg-[var(--surface)] p-5 text-center shadow-md shadow-[var(--shadow-float)]/20">
              <div className="text-sm font-semibold text-[var(--accent)]">Pro</div>
              <div className="mt-1 text-2xl font-bold text-[var(--text)]">24€<span className="text-sm font-normal text-[var(--text-secondary)]"> / mois</span></div>
              <p className="mt-2 text-xs text-[var(--text-faint)]">Entreprises illimitées, équipe</p>
            </Card>
            <Card className="feature-card-lift border-[var(--border)] bg-[var(--surface)] p-5 text-center">
              <div className="text-sm font-medium text-[var(--text-secondary)]">Équipe</div>
              <div className="mt-1 text-2xl font-bold text-[var(--text)]">Sur devis</div>
              <p className="mt-2 text-xs text-[var(--text-faint)]">Intégrations, support dédié</p>
            </Card>
          </div>
          <div className="text-center">
            <Button asChild variant="outline">
              <Link href="/pricing">Comparer les plans</Link>
            </Button>
          </div>
        </section>
      </ScrollReveal>

      {/* ── FAQ ── */}
      <Faq items={faqItems} />

      {/* ── Final CTA ── */}
      <ScrollReveal animation="reveal-scale">
        <section className="rounded-3xl bg-[var(--accent)] p-8 text-center shadow-md">
          <h2 className="text-2xl font-semibold text-white">Prêt à simplifier votre quotidien ?</h2>
          <p className="mt-3 text-sm text-white/80">
            Créez votre compte gratuitement et commencez à piloter votre activité.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="bg-white text-[var(--accent)] hover:bg-white/90">
              <Link href="/register">Commencer gratuitement</Link>
            </Button>
          </div>
        </section>
      </ScrollReveal>
    </div>
  );
}
