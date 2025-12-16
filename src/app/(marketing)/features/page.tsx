import type { Metadata } from 'next';
import { FeatureGrid } from '@/components/marketing/FeatureGrid';
import { SectionHeader } from '@/components/ui/section-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Fonctionnalités • Lune',
  description: 'Découvrez les modules PRO et personnels de Lune, prêts à l’usage.',
};

const proFeatures = [
  {
    title: 'Hub multi-entreprises',
    category: 'PRO' as const,
    description: 'Liste des entreprises, rôles, switch instantané, invites par token.',
  },
  {
    title: 'Pipeline prospects',
    category: 'PRO' as const,
    description: 'Statuts, probabilités, budgets estimés, actions rapides, notes.',
  },
  {
    title: 'Clients & projets',
    category: 'PRO' as const,
    description: 'Listes mobiles + pages détail stables pour pilotage et finances.',
  },
  {
    title: 'Finances PRO',
    category: 'PRO' as const,
    description: 'Invoices/expenses existants + pages treasury/VAT/payments prêtes.',
  },
  {
    title: 'Process & services',
    category: 'PRO' as const,
    description: 'Squelettes process/services/tasks pour structurer vos SOP.',
  },
  {
    title: 'Invitations & rôles',
    category: 'PRO' as const,
    description: 'Invites admin, affichage du rôle, redirections legacy /dash-* sécurisées.',
  },
];

const personalFeatures = [
  {
    title: 'Comptes & transactions',
    category: 'PERSO' as const,
    description: 'Comptes personnels, transactions, catégories, imports CSV.',
  },
  {
    title: 'Budgets & objectifs',
    category: 'PERSO' as const,
    description: 'Budgets, revenus, épargne, vue dashboard finances perso.',
  },
  {
    title: 'Performance croisée',
    category: 'PERFORMANCE' as const,
    description: 'Alignement PRO/PERSO, runway, vision globale.',
  },
  {
    title: 'Sécurité',
    category: 'SECURITE' as const,
    description: 'Auth unifiée, CSRF sur mutations, rate-limit, no-store sur endpoints sensibles.',
  },
  {
    title: 'Mobile-first',
    category: 'PERFORMANCE' as const,
    description: 'App Router optimisé mobile, modals et navigation testées en petit écran.',
  },
  {
    title: 'Design system',
    category: 'PERFORMANCE' as const,
    description: 'Tokens dark/light, composants UI cohérents pour toutes les futures features.',
  },
];

export default function FeaturesPage() {
  return (
    <div className="space-y-12">
      <SectionHeader
        title="Fonctionnalités clés"
        description="Un produit unique pour couvrir vos besoins pro et perso, avec un design calme et sécurisé."
      />

      <FeatureGrid
        title="Espace PRO"
        description="Pour les agences, freelances et équipes qui pilotent prospects, clients, projets et finances."
        items={proFeatures}
      />

      <FeatureGrid
        title="Espace personnel"
        description="Pour suivre vos finances personnelles sans bruit et garder le contrôle."
        items={personalFeatures}
      />

      <SectionHeader
        title="Productivité au quotidien"
        description="Cockpits, hubs et modals pensés pour éviter les frictions et les boucles de fetch."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            title: 'Cockpit entreprise',
            desc: 'Vue synthétique prospects, clients, projets, finances, actions rapides.',
          },
          {
            title: 'Hub /app/pro',
            desc: 'Switch d’entreprise, invites, création et reprise rapide.',
          },
          {
            title: 'Stabilité technique',
            desc: 'AbortController, request-id surfacés, no-store, CSRF, rate-limit.',
          },
        ].map((item) => (
          <Card key={item.title} className="border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="text-base font-semibold text-[var(--text)]">{item.title}</div>
            <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">{item.desc}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-6">
        <div className="flex-1 space-y-2">
          <div className="text-lg font-semibold text-[var(--text)]">Prêt à essayer Lune ?</div>
          <p className="text-sm text-[var(--text-secondary)]">
            Créez un compte en quelques secondes. Vous pourrez ensuite inviter votre équipe et
            configurer vos entreprises.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href="/register">Créer un compte</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/login">Se connecter</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
