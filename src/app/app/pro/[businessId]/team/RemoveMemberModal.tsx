'use client';

import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import type { Member } from './hooks/types';

type Props = {
  removeModal: Member | null;
  actionLoading: boolean;
  setRemoveModal: (m: Member | null) => void;
  confirmRemoval: () => Promise<void>;
};

export function RemoveMemberModal({ removeModal, actionLoading, setRemoveModal, confirmRemoval }: Props) {
  return (
    <Modal
      open={!!removeModal}
      onCloseAction={actionLoading ? () => {} : () => setRemoveModal(null)}
      title="Retirer ce membre ?"
      description={removeModal ? `${removeModal.email} sera retiré de cette entreprise.` : undefined}
    >
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          Action immédiate. Utilise &quot;Quitter&quot; côté membre pour te retirer toi-même.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setRemoveModal(null)} disabled={actionLoading}>
            Annuler
          </Button>
          <Button variant="danger" onClick={() => void confirmRemoval()} disabled={actionLoading}>
            {actionLoading ? 'Retrait…' : 'Retirer'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
