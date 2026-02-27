"use client";

import { getProjectDepositStatusLabelFR } from '@/lib/billingStatus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';

export type DepositDateModalProps = {
  open: boolean;
  depositStatus: string | null | undefined;
  paidAt: string;
  isAdmin: boolean;
  saving: boolean;
  error: string | null;
  onChangePaidAt: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
};

export function DepositDateModal({
  open,
  depositStatus,
  paidAt,
  isAdmin,
  saving,
  error,
  onChangePaidAt,
  onClose,
  onSave,
}: DepositDateModalProps) {
  return (
    <Modal
      open={open}
      onCloseAction={onClose}
      title="Date acompte"
      description="Renseigne la date comptable de paiement de l'acompte."
    >
      <div className="space-y-3">
        <p className="text-xs text-[var(--text-secondary)]">
          Statut acompte : {getProjectDepositStatusLabelFR(depositStatus ?? null)}
        </p>
        <Input
          label="Date de paiement"
          type="date"
          value={paidAt}
          onChange={(e) => onChangePaidAt(e.target.value)}
          disabled={!isAdmin || saving}
        />
        {error ? <p className="text-sm text-rose-500">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={onSave} disabled={!isAdmin || saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
