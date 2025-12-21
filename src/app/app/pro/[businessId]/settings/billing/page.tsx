'use client';

import { useParams } from 'next/navigation';
import { SettingsForm } from '../SettingsForm';

export default function BillingSettingsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  return (
    <SettingsForm
      businessId={businessId}
      title="Paramètres de facturation"
      description="Préfixes, acompte par défaut et délais de paiement."
      fields={[
        { key: 'invoicePrefix', label: 'Préfixe factures', type: 'text', helper: 'Exemple: INV-' },
        { key: 'quotePrefix', label: 'Préfixe devis', type: 'text', helper: 'Exemple: DEV-' },
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
  );
}
