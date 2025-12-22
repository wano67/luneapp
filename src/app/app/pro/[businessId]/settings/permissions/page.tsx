'use client';

import { useParams } from 'next/navigation';
import { SettingsForm } from '../SettingsForm';
import { PageHeader } from '../../../../components/PageHeader';

export default function PermissionsSettingsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  return (
    <div className="space-y-5">
      <PageHeader
        backHref={`/app/pro/${businessId}/settings`}
        backLabel="Paramètres"
        title="Permissions & rôles"
        subtitle="Contrôlez les invitations et exports disponibles pour les membres/viewers."
      />
      <div className="max-w-4xl">
        <SettingsForm
          businessId={businessId}
          title="Permissions & rôles"
          description="Contrôlez les invitations et exports disponibles pour les membres/viewers."
          fields={[
            {
              key: 'allowMembersInvite',
              label: 'Autoriser les membres à inviter',
              type: 'checkbox',
              helper: 'Permettre aux non-admins d’envoyer des invitations.',
            },
            {
              key: 'allowViewerExport',
              label: 'Autoriser export pour viewers',
              type: 'checkbox',
              helper: 'Autoriser les viewers à exporter certaines données.',
            },
          ]}
        />
      </div>
    </div>
  );
}
