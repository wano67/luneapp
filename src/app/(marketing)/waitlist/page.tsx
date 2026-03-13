import type { Metadata } from 'next';
import { ScrollReveal } from '@/components/marketing/ScrollReveal';
import { WaitlistForm } from '@/components/marketing/WaitlistForm';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Pivot • Rejoignez la liste d\'attente',
  description:
    'Pivot arrive bientôt. Inscrivez-vous pour être parmi les premiers à piloter votre activité pro et vos finances perso depuis un seul espace.',
  openGraph: {
    title: 'Pivot • Rejoignez la liste d\'attente',
    description:
      'Pivot arrive bientôt. Inscrivez-vous pour être parmi les premiers à découvrir Pivot.',
  },
};

export default function WaitlistPage() {
  return (
    <div className="flex flex-col items-center space-y-12 pt-8 md:pt-16">
      {/* Hero */}
      <ScrollReveal animation="reveal-up" className="text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
            Bient&ocirc;t disponible
          </span>
        </div>
        <h1 className="mx-auto max-w-2xl text-4xl font-semibold leading-tight md:text-5xl lg:text-6xl">
          Pivot arrive bient&ocirc;t.
        </h1>
        <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-[var(--text-secondary)]">
          Pilotez votre activit&eacute; pro et vos finances perso depuis un seul espace.
          Inscrivez-vous pour &ecirc;tre parmi les premiers.
        </p>
      </ScrollReveal>

      {/* Form card */}
      <ScrollReveal animation="reveal-up" delay={150} className="w-full max-w-lg">
        <Card className="border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <WaitlistForm variant="hero" />
          <p className="mt-4 text-center text-xs text-[var(--text-faint)]">
            Pas de spam. Juste un email quand votre acc&egrave;s sera pr&ecirc;t.
          </p>
        </Card>
      </ScrollReveal>

      {/* Value teaser */}
      <ScrollReveal animation="reveal-up" delay={300} className="w-full max-w-2xl">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: 'Espace Pro',
              desc: 'Clients, projets, devis et factures. Tout pour piloter votre activit\u00e9.',
            },
            {
              title: 'Espace Perso',
              desc: 'Comptes, transactions, budgets et \u00e9pargne en un coup d\u2019\u0153il.',
            },
            {
              title: 'Tout-en-un',
              desc: 'Un seul espace s\u00e9curis\u00e9 pour tout g\u00e9rer au quotidien.',
            },
          ].map((item) => (
            <div key={item.title} className="text-center">
              <div className="text-sm font-semibold text-[var(--text)]">{item.title}</div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">{item.desc}</p>
            </div>
          ))}
        </div>
      </ScrollReveal>
    </div>
  );
}
