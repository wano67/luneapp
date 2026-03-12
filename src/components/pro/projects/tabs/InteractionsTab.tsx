'use client';

import { InteractionsList } from '@/components/pro/interactions/InteractionsList';

type Props = {
  businessId: string;
  projectId: string;
  isAdmin: boolean;
};

export function InteractionsTab({ businessId, projectId, isAdmin }: Props) {
  return (
    <InteractionsList
      businessId={businessId}
      projectId={projectId}
      isAdmin={isAdmin}
    />
  );
}
