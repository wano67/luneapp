import type { Metadata } from 'next';
import { ScrollReveal } from '@/components/marketing/ScrollReveal';
import { StaggerChildren } from '@/components/marketing/StaggerChildren';
import { SectionHeader } from '@/components/ui/section-header';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Sécurité • Pivot',
  description: 'Vos données sont protégées par défaut. Découvrez comment Pivot sécurise votre espace.',
};

const protections = [
  {
    title: 'Connexion sécurisée',
    desc: 'Votre session est protégée par des cookies sécurisés. Personne ne peut usurper votre identité.',
  },
  {
    title: 'Données isolées',
    desc: 'Chaque entreprise et chaque espace personnel sont cloisonnés. Vos données ne sont visibles que par vous et vos collaborateurs.',
  },
  {
    title: 'Protection contre les abus',
    desc: 'Les actions sensibles sont limitées en fréquence pour prévenir tout usage abusif.',
  },
  {
    title: 'Pas de suivi publicitaire',
    desc: 'Aucun cookie de tracking, aucune publicité. Vos données ne sont ni vendues ni partagées.',
  },
];

export default function SecurityPage() {
  return (
    <div className="space-y-12">
      <ScrollReveal>
        <SectionHeader
          variant="marketing"
          title="Vos données, protégées par défaut"
          description="La sécurité n'est pas une option chez Pivot. Elle est intégrée dès la conception."
        />
      </ScrollReveal>

      <StaggerChildren className="grid gap-4 md:grid-cols-2">
        {protections.map((item) => (
          <Card key={item.title} className="feature-card-lift border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="text-base font-semibold text-[var(--text)]">{item.title}</div>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{item.desc}</p>
          </Card>
        ))}
      </StaggerChildren>

      <ScrollReveal>
        <Card className="border-[var(--border)] bg-[var(--surface-2)] p-6">
          <div className="text-base font-semibold text-[var(--text)]">Notre engagement</div>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
            Nous ne vendons pas vos données. Nous n&apos;affichons pas de publicités.
            Pivot est financé par ses abonnements, pas par vos informations personnelles.
            Vous pouvez exporter ou supprimer vos données à tout moment.
          </p>
        </Card>
      </ScrollReveal>
    </div>
  );
}
