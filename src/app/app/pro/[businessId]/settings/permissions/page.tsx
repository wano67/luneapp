'use client';

import { useParams } from 'next/navigation';
import { SettingsForm } from '../SettingsForm';

export default function PermissionsSettingsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  return (
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
  );
}
