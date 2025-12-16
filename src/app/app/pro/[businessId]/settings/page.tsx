// src/app/app/pro/[businessId]/settings/page.tsx
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function BusinessSettingsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  const links = [
    { href: `/app/pro/${businessId}/settings/billing`, label: 'Billing', desc: 'Coordonnées de facturation, devises, préférences' },
    { href: `/app/pro/${businessId}/settings/taxes`, label: 'Taxes', desc: 'TVA, périodes, seuils' },
    { href: `/app/pro/${businessId}/settings/team`, label: 'Team', desc: 'Membres et rôles' },
    { href: `/app/pro/${businessId}/settings/integrations`, label: 'Integrations', desc: 'Outillage connecté (CRM, compta, etc.)' },
    { href: `/app/pro/${businessId}/settings/permissions`, label: 'Permissions', desc: 'Contrôles d’accès avancés' },
  ];

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
          PRO · Settings
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Paramètres entreprise</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Configure la facturation, la fiscalité, l’équipe et les intégrations de ton business.
        </p>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {links.map((link) => (
          <Card key={link.href} className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{link.label}</p>
                <p className="text-xs text-[var(--text-secondary)]">{link.desc}</p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={link.href}>Ouvrir</Link>
              </Button>
            </div>
            <p className="text-[10px] text-[var(--text-secondary)]">API à venir · données locales non persistées</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
