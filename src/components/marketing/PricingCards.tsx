import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';

type Tier = {
  name: string;
  price: string;
  period: string;
  description: string;
  cta: string;
  highlight?: boolean;
  features: string[];
};

const tiers: Tier[] = [
  {
    name: 'Essentiel',
    price: 'Gratuit',
    period: 'pour démarrer',
    description: 'Pour tester Lune avec un workspace personnel et un premier business.',
    cta: "S'inscrire",
    features: ['Accès Perso', '1 entreprise PRO', 'Invitations équipe limitées', 'Support mail'],
  },
  {
    name: 'Pro',
    price: '24€',
    period: 'par mois',
    description: 'Pour les agences/indés qui pilotent prospects, clients et finances.',
    cta: 'Essai 14 jours',
    highlight: true,
    features: [
      'Entreprises illimitées',
      'Prospects/Clients/Projets',
      'Finances PRO + exports',
      'Switch multi-entreprise',
      'Support prioritaire',
    ],
  },
  {
    name: 'Equipe',
    price: 'Sur devis',
    period: '',
    description: 'Pour les équipes avec besoins avancés et intégrations personnalisées.',
    cta: 'Nous contacter',
    features: ['Permissions avancées', 'SLA et support dédié', 'Intégrations custom', 'Onboarding assisté'],
  },
];

export function PricingCards() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {tiers.map((tier) => (
        <Card
          key={tier.name}
          className={cn(
            'flex h-full flex-col gap-4 border-[var(--border)] bg-[var(--surface)] p-6',
            tier.highlight ? 'border-[var(--accent-strong)] shadow-md shadow-[var(--shadow-float)]/30' : ''
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[var(--text-muted)]">{tier.name}</div>
              <div className="mt-2 flex items-baseline gap-1 text-3xl font-semibold text-[var(--text)]">
                {tier.price}
                <span className="text-sm font-medium text-[var(--text-secondary)]">{tier.period}</span>
              </div>
            </div>
            {tier.highlight ? <Badge variant="pro">PRO</Badge> : null}
          </div>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{tier.description}</p>
          <Button variant={tier.highlight ? 'primary' : 'outline'}>
            {tier.cta}
          </Button>
          <div className="space-y-2 text-sm text-[var(--text)]">
            {tier.features.map((feat) => (
              <div key={feat} className="flex items-start gap-2">
                <span className="mt-1 inline-block h-2 w-2 rounded-full bg-[var(--accent)]" />
                <span className="leading-relaxed text-[var(--text-secondary)]">{feat}</span>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
