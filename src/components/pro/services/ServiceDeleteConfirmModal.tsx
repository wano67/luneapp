"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { fetchJson } from '@/lib/apiClient';

type Service = { id: string; code: string; name: string };

type Props = {
  target: Service | null;
  businessId: string;
  isAdmin: boolean;
  onClose: () => void;
  onAfterDelete: () => void;
};

export function ServiceDeleteConfirmModal({ target, businessId, isAdmin, onClose, onAfterDelete }: Props) {
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!target) return;
    if (!isAdmin) {
      setDeleteError('Suppression réservée aux rôles ADMIN/OWNER.');
      return;
    }
    setDeleteError(null);
    const res = await fetchJson<null>(
      `/api/pro/businesses/${businessId}/services/${target.id}`,
      { method: 'DELETE' }
    );
    if (!res.ok) {
      const msg = res.error ?? 'Suppression impossible.';
      setDeleteError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      return;
    }
    onClose();
    onAfterDelete();
  }

  return (
    <Modal
      open={Boolean(target)}
      onCloseAction={onClose}
      title="Supprimer le service ?"
      description="Cette action est définitive et retire le service du catalogue."
    >
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          {target ? `${target.name} (${target.code})` : ''}
        </p>
        {deleteError ? <p className="text-sm font-semibold text-[var(--danger)]">{deleteError}</p> : null}
        {!isAdmin ? (
          <p className="text-xs text-[var(--text-secondary)]">
            Suppression réservée aux rôles ADMIN/OWNER.
          </p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="ghost" onClick={confirmDelete} disabled={!isAdmin}>
            Supprimer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
