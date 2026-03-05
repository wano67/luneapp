'use client';

import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { ROLE_LABELS, type BusinessRole, type Member } from './hooks/types';

type Props = {
  roleModal: { member: Member; nextRole: BusinessRole } | null;
  actionLoading: boolean;
  cancelRoleChange: () => void;
  confirmRoleChange: () => Promise<void>;
};

export function RoleChangeModal({ roleModal, actionLoading, cancelRoleChange, confirmRoleChange }: Props) {
  return (
    <Modal
      open={!!roleModal}
      onCloseAction={actionLoading ? () => {} : cancelRoleChange}
      title="Confirmer le changement de rôle"
      description={
        roleModal
          ? `Passer ${roleModal.member.email} en ${ROLE_LABELS[roleModal.nextRole]} ?`
          : undefined
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          Les permissions changeront immédiatement. Tu ne peux pas modifier les owners ou ton propre rôle.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={cancelRoleChange} disabled={actionLoading}>
            Annuler
          </Button>
          <Button onClick={() => void confirmRoleChange()} disabled={actionLoading}>
            {actionLoading ? 'Modification…' : 'Confirmer'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
