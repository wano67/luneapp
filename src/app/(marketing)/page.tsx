import type { Metadata } from 'next';
import { Card } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { ScrollReveal } from '@/components/marketing/ScrollReveal';
import { StaggerChildren } from '@/components/marketing/StaggerChildren';
import { WaitlistForm } from '@/components/marketing/WaitlistForm';
import { AppFacade } from '@/components/marketing/AppFacade';

export const metadata: Metadata = {
  title: 'Pivot • Votre activité pro et vos finances perso, bientôt réunies',
  description:
    'Pivot arrive bientôt. Un seul espace pour piloter votre activité professionnelle et vos finances personnelles. Rejoignez la liste d\'attente.',
  openGraph: {
    title: 'Pivot • Bientôt disponible',
    description:
      'Un seul espace pour piloter votre activité pro et vos finances perso. Rejoignez la liste d\'attente.',
  },
};

const keyFeatures = [
  {
    title: 'Comptabilité automatisée',
    desc: 'Grand livre, bilan, TVA et export FEC générés automatiquement. Votre comptable reçoit un dossier propre, sans effort.',
  },
  {
    title: 'Patrimoine en temps réel',
    desc: 'Comptes bancaires, épargne, investissements, immobilier. Visualisez l\'ensemble de votre patrimoine sur un seul tableau de bord.',
  },
  {
    title: 'Projections financières',
    desc: 'Simulez votre trésorerie, vos revenus nets et votre épargne à 3, 6, 12 mois. Prenez des décisions éclairées.',
  },
  {
    title: 'Factures et devis certifiés PDP',
    desc: 'Créez, envoyez et suivez vos devis et factures conformes Factur-X. Numérotation automatique, export PDF et signature électronique.',
  },
  {
    title: 'Impôts et charges automatiques',
    desc: 'IS, TVA, cotisations sociales, rémunération du dirigeant. Pivot calcule tout et vous donne une vision nette de votre résultat.',
  },
  {
    title: 'Gestion d\'équipe',
    desc: 'Invitez vos collaborateurs, assignez des rôles, organisez par pôles. Tâches, calendrier partagé et suivi de charge.',
  },
];

export default function HomePage() {
  return (
    <div className="space-y-24">
      {/* ── Hero ── */}
      <section className="flex flex-col items-center pt-8 text-center md:pt-16">
        <ScrollReveal animation="reveal-up">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
              En construction
            </span>
          </div>
        </ScrollReveal>
        <ScrollReveal animation="reveal-up" delay={50}>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight md:text-5xl lg:text-6xl">
            Votre activit&eacute; pro et vos finances perso, bient&ocirc;t r&eacute;unies.
          </h1>
        </ScrollReveal>
        <ScrollReveal animation="reveal-up" delay={100}>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--text-secondary)]">
            Pivot est l&apos;espace unique pour piloter vos clients, projets, factures
            et suivre vos d&eacute;penses personnelles. Simple, s&eacute;curis&eacute;, accessible.
          </p>
        </ScrollReveal>
        <ScrollReveal animation="reveal-up" delay={200} className="mt-8 w-full max-w-md">
          <WaitlistForm variant="hero" />
        </ScrollReveal>
      </section>

      {/* ── App facade ── */}
      <ScrollReveal animation="reveal-scale" delay={100}>
        <AppFacade />
      </ScrollReveal>

      {/* ── Key features that save time ── */}
      <section className="space-y-8">
        <ScrollReveal>
          <SectionHeader
            variant="marketing"
            title="Ce qui vous fait gagner du temps"
            description="Des automatismes pens&eacute;s pour les ind&eacute;pendants, agences et petites &eacute;quipes."
          />
        </ScrollReveal>
        <StaggerChildren className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {keyFeatures.map((item) => (
            <Card key={item.title} className="feature-card-lift border-[var(--border)] bg-[var(--surface)] p-6">
              <div className="text-base font-semibold text-[var(--text)]">{item.title}</div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{item.desc}</p>
            </Card>
          ))}
        </StaggerChildren>
      </section>

      {/* ── Two spaces ── */}
      <section className="space-y-6">
        <ScrollReveal>
          <SectionHeader
            variant="marketing"
            title="Deux espaces, un seul outil"
            description="Pro et perso cohabitent sans se m&eacute;langer."
          />
        </ScrollReveal>
        <StaggerChildren className="grid gap-6 md:grid-cols-2">
          <Card className="feature-card-lift border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="mb-2 text-lg font-semibold text-[var(--text)]">Espace Pro</div>
            <ul className="space-y-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
              <li>Prospects, clients et pipeline commercial</li>
              <li>Projets, services et suivi d&apos;avancement</li>
              <li>Devis, factures et comptabilit&eacute; automatis&eacute;e</li>
              <li>Gestion d&apos;&eacute;quipe, t&acirc;ches et calendrier</li>
              <li>Stock, catalogue et portail client</li>
            </ul>
          </Card>
          <Card className="feature-card-lift border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="mb-2 text-lg font-semibold text-[var(--text)]">Espace Personnel</div>
            <ul className="space-y-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
              <li>Comptes bancaires et sync Open Banking</li>
              <li>Transactions, cat&eacute;gorisation et r&egrave;gles auto</li>
              <li>Budgets mensuels et suivi des d&eacute;penses</li>
              <li>&Eacute;pargne, objectifs et projection patrimoniale</li>
              <li>Abonnements et charges fixes</li>
            </ul>
          </Card>
        </StaggerChildren>
      </section>

      {/* ── Final CTA ── */}
      <ScrollReveal animation="reveal-scale">
        <section className="rounded-3xl bg-[var(--accent)] p-8 text-center shadow-md">
          <h2 className="text-2xl font-semibold text-white">Pr&ecirc;t &agrave; simplifier votre quotidien ?</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-white/80">
            Rejoignez la liste d&apos;attente et soyez parmi les premiers &agrave; d&eacute;couvrir Pivot.
          </p>
          <div className="mx-auto mt-6 max-w-sm">
            <WaitlistForm />
          </div>
        </section>
      </ScrollReveal>
    </div>
  );
}
