'use client';

import { useParams } from 'next/navigation';
import { SettingsForm } from './SettingsForm';
import { PageHeader } from '../../../components/PageHeader';

export default function BusinessSettingsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  return (
    <div className="space-y-5">
      <PageHeader
        backHref={`/app/pro/${businessId}`}
        backLabel="Dashboard"
        title="Paramètres entreprise"
        subtitle="Configurez les préfixes, délais de paiement, TVA et autorisations globales."
      />
      <div className="max-w-4xl">
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
    </div>
  );
}
