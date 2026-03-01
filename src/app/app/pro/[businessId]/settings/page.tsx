'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { ProPageShell } from '@/components/pro/ProPageShell';
import { SettingsForm } from './SettingsForm';
import { BusinessInfoForm } from './BusinessInfoForm';

const TABS = [
  { key: 'general', label: 'Général' },
  { key: 'team', label: 'Équipe' },
  { key: 'billing', label: 'Facturation' },
  { key: 'organization', label: 'Organisation' },
  { key: 'references', label: 'Référentiels' },
  { key: 'integrations', label: 'Intégrations' },
  { key: 'taxes', label: 'Taxes' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function BusinessSettingsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const businessId = (params?.businessId ?? '') as string;
  const requestedTab = (searchParams?.get('tab') ?? TABS[0].key) as TabKey;
  const currentTab = useMemo(
    () => (TABS.some((t) => t.key === requestedTab) ? requestedTab : TABS[0].key),
    [requestedTab]
  );

  const handleTabChange = (key: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('tab', key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const content = useMemo(() => {
    switch (currentTab) {
      case 'general':
        return (
          <div className="max-w-4xl space-y-4">
            <BusinessInfoForm businessId={businessId} />
            <SettingsForm
              businessId={businessId}
              title="Paramètres entreprise"
              description="Configurez les préfixes, délais de paiement, TVA et autorisations globales."
              fields={[
                { key: 'invoicePrefix', label: 'Préfixe factures', type: 'text', helper: 'Exemple: INV-' },
                { key: 'quotePrefix', label: 'Préfixe devis', type: 'text', helper: 'Exemple: DEV-' },
                {
                  key: 'paymentTermsDays',
                  label: 'Délais de paiement (jours)',
                  type: 'number',
                  min: 0,
                  max: 365,
                  helper: 'Délais par défaut appliqué aux factures.',
                },
                {
                  key: 'defaultDepositPercent',
                  label: 'Acompte par défaut (%)',
                  type: 'number',
                  min: 0,
                  max: 100,
                },
                {
                  key: 'enableAutoNumbering',
                  label: 'Numérotation automatique',
                  type: 'checkbox',
                  helper: 'Générer automatiquement les numéros de devis/facture.',
                },
                {
                  key: 'vatEnabled',
                  label: 'TVA activée',
                  type: 'checkbox',
                  helper: 'Active la TVA sur les documents.',
                },
                {
                  key: 'vatRatePercent',
                  label: 'Taux TVA (%)',
                  type: 'number',
                  min: 0,
                  max: 100,
                },
                {
                  key: 'allowMembersInvite',
                  label: 'Autoriser les membres à inviter',
                  type: 'checkbox',
                  helper: 'Permet aux membres (non admins) d’envoyer des invitations.',
                },
                {
                  key: 'allowViewerExport',
                  label: 'Autoriser export pour viewers',
                  type: 'checkbox',
                  helper: 'Permet aux viewers de télécharger/exporter certaines données.',
                },
              ]}
            />
          </div>
        );
      case 'team':
        return (
          <PlaceholderCard
            title="Équipe"
            description="Gérez les membres et leurs rôles. Accéder aux paramètres détaillés si besoin."
            href={`/app/pro/${businessId}/settings/team`}
            linkLabel="Ouvrir la gestion d’équipe"
          />
        );
      case 'billing':
        return (
          <PlaceholderCard
            title="Facturation"
            description="Configurez la facturation et les préférences de paiement."
            href={`/app/pro/${businessId}/settings/billing`}
            linkLabel="Aller à la facturation"
          />
        );
      case 'organization':
        return (
          <PlaceholderCard
            title="Organisation"
            description="Gérez la structure de votre entreprise : pôles, départements, organigramme."
            href={`/app/pro/${businessId}/organization`}
            linkLabel="Gérer l'organisation"
          />
        );
      case 'references':
        return (
          <PlaceholderCard
            title="Référentiels"
            description="Catégories, tags, numérotation et automatisations."
            href={`/app/pro/${businessId}/references`}
            linkLabel="Gérer les référentiels"
          />
        );
      case 'integrations':
        return (
          <PlaceholderCard
            title="Intégrations"
            description="Connectez vos outils externes (CRM, emailing, automatisation)."
            href={`/app/pro/${businessId}/settings/integrations`}
            linkLabel="Voir les intégrations"
          />
        );
      case 'taxes':
        return (
          <PlaceholderCard
            title="Taxes"
            description="Définissez vos règles de TVA et fiscalité."
            href={`/app/pro/${businessId}/settings/taxes`}
            linkLabel="Configurer les taxes"
          />
        );
      default:
        return null;
    }
  }, [businessId, currentTab]);

  return (
    <ProPageShell
      backHref={`/app/pro/${businessId}`}
      backLabel="Dashboard"
      title="Paramètres entreprise"
      subtitle="Configurez les préfixes, délais de paiement, TVA et autorisations globales."
      tabs={TABS}
      activeTab={currentTab}
      onTabChange={handleTabChange}
    >
      <div className="space-y-4">{content}</div>
    </ProPageShell>
  );
}

function PlaceholderCard({
  title,
  description,
  href,
  linkLabel,
}: {
  title: string;
  description: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <Card className="max-w-4xl p-4 text-sm text-[var(--text-secondary)]">
      <p className="text-[var(--text-primary)]">{title}</p>
      <p className="mt-1 text-[var(--text-secondary)]">{description}</p>
      <Link
        href={href}
        className="mt-3 inline-flex cursor-pointer items-center text-sm font-semibold text-[var(--text-primary)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
      >
        {linkLabel}
      </Link>
    </Card>
  );
}
