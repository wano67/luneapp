'use client';

import { useParams } from 'next/navigation';
import { SettingsForm } from '../SettingsForm';
import { PageHeader } from '../../../../components/PageHeader';
import { BillingProfileForm } from './BillingProfileForm';
import { BillingLegalTextsForm } from './BillingLegalTextsForm';

export default function BillingSettingsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  return (
    <div className="space-y-5">
      <PageHeader
        backHref={`/app/pro/${businessId}/settings`}
        backLabel="Paramètres"
        title="Paramètres de facturation"
        subtitle="Préfixes, acompte par défaut et délais de paiement."
      />
      <div className="max-w-4xl space-y-6">
        <SettingsForm
          businessId={businessId}
          title="Paramètres de facturation"
          description="Préfixes, acompte par défaut et délais de paiement."
          fields={[
            {
              key: 'invoicePrefix',
              label: 'Préfixe factures',
              type: 'text',
              helper: 'Format imposé: SF-FAC-YYYY-####',
              readOnly: true,
            },
            {
              key: 'quotePrefix',
              label: 'Préfixe devis',
              type: 'text',
              helper: 'Format imposé: SF-DEV-YYYY-####',
              readOnly: true,
            },
            {
              key: 'defaultDepositPercent',
              label: 'Acompte par défaut (%)',
              type: 'number',
              min: 0,
              max: 100,
            },
            {
              key: 'paymentTermsDays',
              label: 'Délais de paiement (jours)',
              type: 'number',
              min: 0,
              max: 365,
              helper: 'S’applique par défaut aux factures.',
            },
            {
              key: 'enableAutoNumbering',
              label: 'Numérotation automatique',
              type: 'checkbox',
              helper: 'Générer automatiquement numéros devis/factures.',
            },
          ]}
        />
        <BillingProfileForm businessId={businessId} />
        <BillingLegalTextsForm businessId={businessId} />
      </div>
    </div>
  );
}
