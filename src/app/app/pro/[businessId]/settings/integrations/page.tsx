'use client';

import { useParams } from 'next/navigation';
import { SettingsForm } from '../SettingsForm';

export default function IntegrationsSettingsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  return (
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
  );
}
