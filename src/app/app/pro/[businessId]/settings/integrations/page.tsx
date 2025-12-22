'use client';

import { useParams } from 'next/navigation';
import { SettingsForm } from '../SettingsForm';
import { PageHeader } from '../../../../components/PageHeader';

export default function IntegrationsSettingsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  return (
    <div className="space-y-5">
      <PageHeader
        backHref={`/app/pro/${businessId}/settings`}
        backLabel="Paramètres"
        title="Intégrations"
        subtitle="Activez Stripe (placeholder) et renseignez la clé publique."
      />
      <div className="max-w-4xl">
        <SettingsForm
          businessId={businessId}
          title="Intégrations"
          description="Activez Stripe (placeholder) et renseignez la clé publique."
          fields={[
            {
              key: 'integrationStripeEnabled',
              label: 'Stripe activé',
              type: 'checkbox',
              helper: 'Active l’intégration Stripe (placeholder).',
            },
            {
              key: 'integrationStripePublicKey',
              label: 'Clé publique Stripe',
              type: 'text',
              helper: 'Clé publique (commence souvent par pk_live...).',
              placeholder: 'pk_live_...',
            },
          ]}
        />
      </div>
    </div>
  );
}
