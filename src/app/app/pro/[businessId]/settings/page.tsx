// src/app/app/pro/[businessId]/settings/page.tsx
'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  defaultBillingSettings,
  defaultIntegrations,
  defaultPermissions,
  defaultTaxSettings,
  formatDate,
  type IntegrationSetting,
} from '../../pro-data';
import { usePersistentState } from '../../usePersistentState';

export default function BusinessSettingsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  const [billing] = usePersistentState(`billing:${businessId}`, defaultBillingSettings);
  const [taxes] = usePersistentState(`taxes:${businessId}`, defaultTaxSettings);
  const [integrations] = usePersistentState<IntegrationSetting[]>(
    `integrations:${businessId}`,
    defaultIntegrations
  );
  const [permissions] = usePersistentState(`permissions:${businessId}`, defaultPermissions);

  function latestUpdateFromList(items: Array<{ updatedAt: string }>) {
    if (!items.length) return null;
    const sorted = [...items].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    return sorted[0]?.updatedAt ?? null;
  }

  const links = useMemo(
    () => [
      {
        href: `/app/pro/${businessId}/settings/billing`,
        label: 'Billing',
        desc: 'Coordonnées de facturation, devises, préférences',
        updatedAt: billing.updatedAt,
        updatedBy: billing.updatedBy,
      },
      {
        href: `/app/pro/${businessId}/settings/taxes`,
        label: 'Taxes',
        desc: 'TVA, périodes, seuils',
        updatedAt: taxes.updatedAt,
        updatedBy: taxes.updatedBy,
      },
      {
        href: `/app/pro/${businessId}/settings/team`,
        label: 'Team',
        desc: 'Membres et rôles',
        updatedAt: null,
        updatedBy: null,
      },
      {
        href: `/app/pro/${businessId}/settings/integrations`,
        label: 'Integrations',
        desc: 'Outillage connecté (CRM, compta, etc.)',
        updatedAt: latestUpdateFromList(integrations),
        updatedBy: integrations[0]?.updatedBy ?? null,
      },
      {
        href: `/app/pro/${businessId}/settings/permissions`,
        label: 'Permissions',
        desc: 'Contrôles d’accès avancés',
        updatedAt: permissions[0]?.updatedAt ?? null,
        updatedBy: permissions[0]?.updatedBy ?? null,
      },
    ],
    [billing, businessId, integrations, permissions, taxes]
  );

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
            <p className="text-[10px] text-[var(--text-secondary)]">
              {link.updatedAt
                ? `Mis à jour le ${formatDate(link.updatedAt)}`
                : 'Brouillon local prêt à configurer.'}
            </p>
            {link.updatedBy ? (
              <p className="text-[10px] text-[var(--text-secondary)]">Par {link.updatedBy}</p>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
