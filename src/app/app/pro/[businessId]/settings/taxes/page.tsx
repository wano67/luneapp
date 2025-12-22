'use client';

import { useParams } from 'next/navigation';
import { SettingsForm } from '../SettingsForm';
import { PageHeader } from '../../../../components/PageHeader';

export default function TaxesSettingsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  return (
    <div className="space-y-5">
      <PageHeader
        backHref={`/app/pro/${businessId}/settings`}
        backLabel="Paramètres"
        title="Paramètres TVA/Taxes"
        subtitle="Activez ou désactivez la TVA et définissez le taux par défaut."
      />
      <div className="max-w-4xl">
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
      </div>
    </div>
  );
}
