import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { BookOpen, FileCode, LifeBuoy, Shield, UserRound } from 'lucide-react';

const resourceLinks = [
  {
    href: '/api-docs.html',
    label: 'API & Swagger',
    description: 'Consulter et tester les endpoints REST exposés par l’app.',
    icon: <FileCode size={18} aria-hidden />,
    external: false,
  },
  {
    href: '/app/pro',
    label: 'Espace Pro',
    description: 'Accéder aux fonctionnalités Studio (projets, tâches, facturation).',
    icon: <BookOpen size={18} aria-hidden />,
    external: false,
  },
  {
    href: '/app/account',
    label: 'Compte & profil',
    description: 'Gérer vos informations, préférences et sécurité.',
    icon: <UserRound size={18} aria-hidden />,
    external: false,
  },
  {
    href: '/security',
    label: 'Sécurité',
    description: 'Principes de sécurité et confidentialité (page publique).',
    icon: <Shield size={18} aria-hidden />,
    external: false,
  },
];

export default function DocsPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">Documentation</p>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Ressources produit & API</h1>
        <p className="text-sm leading-6 text-[var(--text-secondary)]">
          Retrouvez ici les points d’entrée pour consulter l’API, comprendre les écrans clés et contacter l’équipe.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {resourceLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="card-interactive block h-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:-translate-y-[1px] hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-[var(--text-secondary)]">{item.icon}</div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{item.label}</p>
                <p className="text-sm leading-6 text-[var(--text-secondary)]">{item.description}</p>
                <p className="text-xs font-medium text-[var(--text-secondary)]">
                  {item.external ? 'Ouvre un nouvel onglet' : 'Ouvre dans l’app'}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <Card className="border border-dashed border-[var(--border)] bg-[var(--surface)]">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-[var(--text-secondary)]">
              <LifeBuoy size={18} aria-hidden />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Support & questions</p>
              <p className="text-sm leading-6 text-[var(--text-secondary)]">
                Besoin d’aide ou d’un exemple précis ? Contactez-nous, nous vous répondrons rapidement.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href="/contact"
              className="card-interactive inline-flex items-center justify-center rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            >
              Formulaire de contact
            </Link>
            <Link
              href="/api-docs.html"
              className="card-interactive inline-flex items-center justify-center rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            >
              Ouvrir l’API
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
