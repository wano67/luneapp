'use client';

import { useParams } from 'next/navigation';
import { SettingsForm } from '../SettingsForm';

export default function TaxesSettingsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  return (
    <SettingsForm
      businessId={businessId}
      title="Paramètres TVA/Taxes"
      description="Activez ou désactivez la TVA et définissez le taux par défaut."
      fields={[
        { key: 'vatEnabled', label: 'TVA activée', type: 'checkbox' },
        {
          key: 'vatRatePercent',
          label: 'Taux TVA (%)',
          type: 'number',
          min: 0,
          max: 100,
          helper: 'Taux par défaut appliqué aux devis/factures.',
        },
      ]}
    />
  );
}
