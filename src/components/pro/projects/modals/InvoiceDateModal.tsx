"use client";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';

export type InvoiceDateEditorState = {
  invoiceId: string;
  number: string | null;
  status: string;
  paidAt: string;
};

export type InvoiceDateModalProps = {
  editor: InvoiceDateEditorState | null;
  isAdmin: boolean;
  saving: boolean;
  error: string | null;
  onChangePaidAt: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
};

export function InvoiceDateModal({
  editor,
  isAdmin,
  saving,
  error,
  onChangePaidAt,
  onClose,
  onSave,
}: InvoiceDateModalProps) {
  return (
    <Modal
      open={Boolean(editor)}
      onCloseAction={onClose}
      title="Date de paiement"
      description="Modifie la date de règlement de la facture."
    >
      <div className="space-y-3">
        <p className="text-xs text-[var(--text-secondary)]">
          {editor?.number ?? `Facture #${editor?.invoiceId ?? ''}`} · Statut {editor?.status ?? '—'}
        </p>
        <Input
          label="Date de paiement"
          type="date"
          value={editor?.paidAt ?? ''}
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
